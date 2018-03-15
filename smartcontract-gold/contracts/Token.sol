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

contract TokenERC20 is Ownable {
    using SafeMath for uint;
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    address public owner;
    uint256 public initialSupply;
    uint256 public totalSupply;
    bool public isEnabled;

    mapping (address => bool) public saleAgents;
    mapping (address => mapping (address => uint256)) internal allowed;
    mapping (address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Burn(address indexed from, uint256 value);

    function TokenERC20(
        uint256 _initialSupply,
        string _tokenName,
        string _tokenSymbol
    ) public
    {
        uint256 localInitialSupply = _initialSupply.mul(10 ** uint256(decimals)); // Подсчитываем общее количество токенов
        
        initialSupply = localInitialSupply;
        totalSupply = localInitialSupply; // Записываем общее количество выпускаемых токенов

        balanceOf[this] = localInitialSupply.div(3).mul(2); // Записываем две трети токенов на адрес текущего контракта токена
        balanceOf[msg.sender] = localInitialSupply.div(3); // Треть токенов переводим создателю контракта
        name = _tokenName; // Записываем название токена
        symbol = _tokenSymbol; // Записываем символ токена
        owner = msg.sender; // Делаем создателя контракта владельцем
    }

    function _transfer(address _from, address _to, uint256 _value) internal {
        require(_to != 0x0);
        require(_value <= balanceOf[_from]);
        require(balanceOf[_to].add(_value) > balanceOf[_to]);
        require(isEnabled || saleAgents[msg.sender]);

        uint256 previousBalances = balanceOf[_from].add(balanceOf[_to]);
        balanceOf[_from] = balanceOf[_from].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        Transfer(_from, _to, _value);
        assert(balanceOf[_from].add(balanceOf[_to]) == previousBalances);
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        _transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(_value <= allowed[_from][msg.sender]);

        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
         _transfer(_from, _to, _value);
        return true;
    }

    function sendToSaleAgent (address _saleAgent, uint256 _value) public {
        require(saleAgents[_saleAgent]);
        require(_value <= balanceOf[this]);
        balanceOf[this] = balanceOf[this].sub(_value);
        balanceOf[_saleAgent] = balanceOf[_saleAgent].add(_value);
    }
    

    function approve(address _spender, uint256 _value) public returns (bool) {
        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }

    function allowance(address _owner, address _spender) public view returns (uint256) {
        return allowed[_owner][_spender];
    }

    function increaseApproval(address _spender, uint _addedValue) public returns (bool) {
        allowed[msg.sender][_spender] = allowed[msg.sender][_spender].add(_addedValue);
        Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
        return true;
    }

    function decreaseApproval(address _spender, uint _subtractedValue) public returns (bool) {
        uint oldValue = allowed[msg.sender][_spender];
        if (_subtractedValue > oldValue) {
          allowed[msg.sender][_spender] = 0;
        } else {
          allowed[msg.sender][_spender] = oldValue.sub(_subtractedValue);
        }
        Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
        return true;
    }


    function burn(uint256 _value) public returns (bool) {
        require(balanceOf[msg.sender] >= _value);   // Проверяем, достаточно ли средств у сжигателя

        address burner = msg.sender;
        balanceOf[burner] = balanceOf[burner].sub(_value);  // Списываем с баланса сжигателя
        totalSupply = totalSupply.sub(_value);  // Обновляем общее количество токенов
        Burn(burner, _value);
        Transfer(burner, address(0x0), _value);
        return true;
    }

    function addSaleAgent (address _saleAgent) public onlyOwner {
        saleAgents[_saleAgent] = true;
        allowed[this][_saleAgent] = totalSupply;
    }

    function disable () public onlyOwner {
        require(isEnabled);
        isEnabled = false;
    }
    function enable () public onlyOwner {
        require(!isEnabled);
        isEnabled = true;
    }
}

contract Token is TokenERC20 {
    function Token() public TokenERC20(100000000, "SomeCrowdsaleToken", "SCT") {}

}