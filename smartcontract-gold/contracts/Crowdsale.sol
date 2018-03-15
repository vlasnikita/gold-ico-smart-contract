pragma solidity ^0.4.18;


library SafeMath {
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        return c;
    }
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a / b;
        return c;
    }
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }
}


interface ERC20 {
  function transfer (address _beneficiary, uint256 _tokenAmount) external returns (bool);  
  function sendToSaleAgent (address _saleAgent, uint256 _value) external;
}


contract Ownable {
    address public owner;
    function Ownable() public {
        owner = msg.sender;
    }
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }
}


contract Crowdsale is Ownable {
  using SafeMath for uint256;

  modifier onlyWhileOpen {
      require(now >= (startDate - 120) && now <= endDate);
      _;
  }

  // The token being sold
  ERC20 public token;

  // Address where funds are collected
  address public wallet;

  // Сколько токенов покупатель получает за 1 эфир
  uint256 public rate;

  // Amount of wei raised
  uint256 public weiRaised;

  // Потолок привлечения средств в ходе ICO в wei
  uint256 public hardcap;

  // Цена ETH в центах
  uint256 public ETHUSD;

  // Дата начала
  uint256 public startDate;

  // Дата окончания
  uint256 public endDate;

  // Бонус за этап, %
  uint8 public stageBonus;

  // Является ли текущий этап - PreICO
  bool public isPreICO;

  // Завершился ли этап
  bool public isFinalized = false;

  // Whitelist
  mapping(address => bool) public whitelist;

  event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);
  event Finalized();

  function Crowdsale(
    uint256 _rate, 
    uint256 _hardcap, 
    address _wallet, 
    uint256 _startDate, 
    uint256 _endDate,
    bool _isPreICO, 
    uint8 _stageBonus
  ) public {
    require(_rate > 0);
    require(_hardcap > 0);
    require(_wallet != address(0));
    require(_startDate + 120 >= now);
    require(_endDate >= _startDate);

    rate = _rate;
    hardcap = _hardcap * 1 ether;
    wallet = _wallet;
    startDate = _startDate;
    endDate = _endDate;
    isPreICO = _isPreICO;

    if(isPreICO){
      stageBonus = 30;
    }else{
      stageBonus = _stageBonus;
    }
  }

  // Установить торгуемй токен
  function setToken (ERC20 _token) public onlyOwner {
    token = _token;
  }
  
  // Установить дату начала
  function setStartDate (uint256 _startDate) public onlyOwner {
    require(_startDate < endDate);
    startDate = _startDate;
  }

  // Установить дату окончания
  function setEndDate (uint256 _endDate) public onlyOwner {
    require(_endDate > startDate);
    endDate = _endDate;
  }

  // Установить стоимость эфира в центах
  function setETHUSD (uint256 _ETHUSD) public onlyOwner {
    ETHUSD = _ETHUSD;
  }

  // Получить токены для продажи
  function getTokens (uint256 _amount) public onlyOwner {
    token.sendToSaleAgent(this, _amount);
  }

  function () external payable {
    buyTokens(msg.sender);
  }

  // Покупка токенов
  function buyTokens(address _beneficiary) public payable {

    uint256 weiAmount = msg.value;
    _preValidatePurchase(_beneficiary, weiAmount);

    // Считаем сколько токенов перевести
    uint256 tokens = _getTokenAmountWithBonus(weiAmount);

    // update state
    weiRaised = weiRaised.add(weiAmount);

    _deliverTokens(_beneficiary, tokens);

    TokenPurchase(msg.sender, _beneficiary, weiAmount, tokens);

    _forwardFunds();
  }

  // Добавить адрес в whitelist
  function addToWhitelist(address _beneficiary) public onlyOwner {
    whitelist[_beneficiary] = true;
  }

  // Добавить несколько адресов в whitelist
  function addManyToWhitelist(address[] _beneficiaries) public onlyOwner {
    for (uint256 i = 0; i < _beneficiaries.length; i++) {
      whitelist[_beneficiaries[i]] = true;
    }
  }

  // Исключить адрес из whitelist
  function removeFromWhitelist(address _beneficiary) external onlyOwner {
    whitelist[_beneficiary] = false;
  }

  // Узнать истек ли срок проведения
  function hasClosed() public view returns (bool) {
    return now > endDate;
  }

  // Завершить этап ICO
  function finalize() onlyOwner public {
      require(!isFinalized);
      require(hasClosed());

      Finalized();
      isFinalized = true;
  }

  /*
   * Внутренние методы
   */

   // Валидация перед покупкой токенов
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal view onlyWhileOpen {
    require(!isFinalized);
    require(_beneficiary != address(0));
    require(_weiAmount != 0);
    require(weiRaised.add(_weiAmount) <= hardcap);
    require(!isPreICO || (isPreICO && whitelist[_beneficiary]));
  }

  // Подсчет количества токенов в зависимости от суммы платежа и бонусных программ
  function _getTokenAmountWithBonus(uint256 _weiAmount) internal view returns(uint256) {
    uint256 baseTokenAmount = _weiAmount.mul(rate);
    uint256 tokenAmount = baseTokenAmount;
    uint256 usdAmount = _weiAmount.mul(ETHUSD).div(10**18);

    // Считаем бонусы за объем инвестиций, если это не этап PreICO
    if(!isPreICO){
      if(usdAmount >= 20000000){
        tokenAmount = tokenAmount.add(baseTokenAmount.mul(10).div(100));
      } else if(usdAmount >= 5000000){
        tokenAmount = tokenAmount.add(baseTokenAmount.mul(7).div(100));
      } else if(usdAmount >= 2000000){
        tokenAmount = tokenAmount.add(baseTokenAmount.mul(5).div(100));
      } else if(usdAmount >= 500000){
        tokenAmount = tokenAmount.add(baseTokenAmount.mul(3).div(100));
      }
    }

    // Считаем бонусы за этап ICO
    if(stageBonus > 0){
      tokenAmount = tokenAmount.add(baseTokenAmount.mul(stageBonus).div(100));
    }
    return tokenAmount;
  }

  // Перевод токенов
  function _deliverTokens(address _beneficiary, uint256 _tokenAmount) internal {
    token.transfer(_beneficiary, _tokenAmount);
  }

  // Перевод средств на кошелек компании
  function _forwardFunds() internal {
    wallet.transfer(msg.value);
  }
}