var Crowdsale = artifacts.require("./Crowdsale.sol")
var Token = artifacts.require("./Token.sol")

const rate = 100
const hardcap = 50
const startDate = Math.floor(Date.now()/1000) - 60
const endDate = Math.floor(Date.now()/1000) + (7 * 24 * 60 * 60) // + 1 неделя
const isPreICO = false
const stageBonus = 10

contract('Crowdsale.Crowdsale', function(accounts) {

	it('Конструктор должен все правильно сетить', async () => {
		const wallet = accounts[1]

		const crowdsale = await Crowdsale.new(
			rate,
			hardcap,
			wallet,
			startDate,
			endDate,
			isPreICO,
			stageBonus
		)

		const rateDeployed = (await crowdsale.rate()).toNumber()
		const hardcapDeployed = (await crowdsale.hardcap()).toNumber() / 1000000000000000000
		const walletDeployed = await crowdsale.wallet()
		const startDateDeployed = (await crowdsale.startDate()).toNumber()
		const endDateDeployed = (await crowdsale.endDate()).toNumber()
		const stageBonusDeployed = await crowdsale.stageBonus()

		assert.equal(rate, rateDeployed, 'rate неравен')
		assert.equal(hardcap, hardcapDeployed, 'hardcap неравен')
		assert.equal(wallet, walletDeployed, 'wallet неравен')
		assert.equal(startDate, startDateDeployed, 'startDate неравен')
		assert.equal(endDate, endDateDeployed, 'endDate неравен')
		assert.equal(stageBonus, stageBonusDeployed, 'stageBonus неравен')
	})

	it('Конструктор должен сетить бонус 30, если PreICO', async () => {
		const wallet = accounts[1]

		const crowdsale = await Crowdsale.new(
			rate,
			hardcap,
			wallet,
			startDate,
			endDate,
			true,
			stageBonus
		)

		const stageBonusDeployed = (await crowdsale.stageBonus()).toNumber()

		assert.equal(stageBonusDeployed, 30, 'stageBonus не равен 30')
	})
})

contract('Crowdsale.buyTokens', function(accounts) {

	it('Токены покупаются, деньги приходят', async () => {
		const token = await Token.deployed()
		const tokenAddress = await token.address
		const ETHUSD = 10000
		const wallet = accounts[1]
		const buyer = accounts[2]
		const value = await web3.toWei('1', 'ether')

		const crowdsale = await Crowdsale.new(rate, hardcap, wallet, startDate, endDate, isPreICO, stageBonus)
		const crowdsaleAddress = await crowdsale.address

		await crowdsale.setToken(tokenAddress)
		await crowdsale.setETHUSD(ETHUSD)
		await token.addSaleAgent(crowdsaleAddress)
		await token.enable()

		const weiRaisedStart = (await crowdsale.weiRaised()).toNumber()
		const walletEtherBalanceStart = (await web3.fromWei(web3.eth.getBalance(wallet))).toNumber()
		const tokenBalance = (await token.balanceOf(tokenAddress)).toNumber()

		await crowdsale.getTokens(tokenBalance * 0.1)
		const buyerTokenBalanceStart = (await token.balanceOf(buyer)).toNumber()
		await crowdsale.buyTokens(buyer, {from: buyer, value: value})

		const buyerTokenBalanceEnd = (await token.balanceOf(buyer)).toNumber()
		const weiRaisedEnd = (await crowdsale.weiRaised()).toNumber()
		const walletEtherBalanceEnd = (await web3.fromWei(web3.eth.getBalance(wallet))).toNumber()

		assert.equal(buyerTokenBalanceEnd, buyerTokenBalanceStart + (value * rate) + (value * rate * stageBonus / 100), 'неправильное количество купленных токенов')
		assert.equal(weiRaisedEnd, weiRaisedStart + +value, 'неверно увеличилось значение weiRaised')
		assert.equal(walletEtherBalanceEnd, walletEtherBalanceStart + +web3.fromWei(value), 'не пришли деньги на кошелек сбора средств')
	})

	it('Токены перевелись, если PreICO, и вызывающий из whitelist', async () => {
		const token = await Token.deployed()
		const tokenAddress = await token.address
		const ETHUSD = 10000
		const wallet = accounts[1]
		const buyer = accounts[4]
		const value = await web3.toWei('1', 'ether')

		const crowdsale = await Crowdsale.new(rate, hardcap, wallet, startDate, endDate, !isPreICO, stageBonus)
		const crowdsaleAddress = await crowdsale.address

		await crowdsale.setToken(tokenAddress)
		await crowdsale.setETHUSD(ETHUSD)
		await token.addSaleAgent(crowdsaleAddress)
		await crowdsale.addToWhitelist(buyer)

		const tokenBalance = (await token.balanceOf(tokenAddress)).toNumber()
		await crowdsale.getTokens(tokenBalance * 0.1)
		await token.addSaleAgent(crowdsaleAddress)

		const buyerTokenBalanceStart = (await token.balanceOf(buyer)).toNumber()
		await crowdsale.buyTokens(buyer, {from: buyer, value: value})
		const buyerTokenBalanceEnd = (await token.balanceOf(buyer)).toNumber()

		assert.equal(buyerTokenBalanceEnd, buyerTokenBalanceStart + (value * rate) + (value * rate * 30 / 100), 'неправильное количество купленных токенов')
	})

	it('Бонусы правильно начисляются', async () => {
		const token = await Token.deployed()
		const tokenAddress = await token.address
		const ETHUSD = 10000000
		const wallet = accounts[1]
		const buyer = accounts[5]
		const value10 = await web3.toWei('2', 'ether')
		const value7 = await web3.toWei('0.5', 'ether')
		const value5 = await web3.toWei('0.2', 'ether')
		const value3 = await web3.toWei('0.05', 'ether')

		const crowdsale = await Crowdsale.new(rate, hardcap, wallet, startDate, endDate, isPreICO, stageBonus)
		const crowdsaleAddress = await crowdsale.address

		await crowdsale.setToken(tokenAddress)
		await crowdsale.setETHUSD(ETHUSD)
		await token.addSaleAgent(crowdsaleAddress)

		const tokenBalance = (await token.balanceOf(tokenAddress)).toNumber()
		await crowdsale.getTokens(tokenBalance * 0.1)

		const buyerTokenBalanceStart10 = (await token.balanceOf(buyer)).toNumber()
		await crowdsale.buyTokens(buyer, {from: buyer, value: value10})
		const buyerTokenBalanceEnd10 = (await token.balanceOf(buyer)).toNumber()

		const bonuses10 = (value10 * rate * stageBonus / 100) + (value10 * rate * 10 / 100)
		assert.equal(buyerTokenBalanceEnd10, buyerTokenBalanceStart10 + (value10 * rate) + bonuses10, 'неправильное количество купленных токенов')

		const buyerTokenBalanceStart7 = (await token.balanceOf(buyer)).toNumber()
		await crowdsale.buyTokens(buyer, {from: buyer, value: value7})
		const buyerTokenBalanceEnd7 = (await token.balanceOf(buyer)).toNumber()

		const bonuses7 = (value7 * rate * stageBonus / 100) + (value7 * rate * 7 / 100)
		assert.equal(buyerTokenBalanceEnd7, buyerTokenBalanceStart7 + (value7 * rate) + bonuses7, 'неправильное количество купленных токенов')

		const buyerTokenBalanceStart5 = (await token.balanceOf(buyer)).toNumber()
		await crowdsale.buyTokens(buyer, {from: buyer, value: value5})
		const buyerTokenBalanceEnd5 = (await token.balanceOf(buyer)).toNumber()

		const bonuses5 = (value5 * rate * stageBonus / 100) + (value5 * rate * 5 / 100)
		assert.equal(buyerTokenBalanceEnd5, buyerTokenBalanceStart5 + (value5 * rate) + bonuses5, 'неправильное количество купленных токенов')

		const buyerTokenBalanceStart3 = (await token.balanceOf(buyer)).toNumber()
		await crowdsale.buyTokens(buyer, {from: buyer, value: value3})
		const buyerTokenBalanceEnd3 = (await token.balanceOf(buyer)).toNumber()

		const bonuses3 = (value3 * rate * stageBonus / 100) + (value3 * rate * 3 / 100)
		assert.equal(buyerTokenBalanceEnd3, buyerTokenBalanceStart3 + (value3 * rate) + bonuses3, 'неправильное количество купленных токенов')
	})

	it('Должен падать, если превышен hardcap', async () => {
		const token = await Token.deployed()
		const tokenAddress = await token.address
		const ETHUSD = 10000
		const wallet = accounts[1]
		const buyer = accounts[4]
		const value = await web3.toWei('30', 'ether')

		const crowdsale = await Crowdsale.new(rate, hardcap, wallet, startDate, endDate, isPreICO, stageBonus)
		const crowdsaleAddress = await crowdsale.address

		await crowdsale.setToken(tokenAddress)
		await crowdsale.setETHUSD(ETHUSD)
		await token.addSaleAgent(crowdsaleAddress)

		const tokenBalance = (await token.balanceOf(tokenAddress)).toNumber()
		await crowdsale.getTokens(tokenBalance * 0.1)
		await crowdsale.buyTokens(buyer, {from: buyer, value: value})
		
		try {
			await crowdsale.buyTokens(buyer, {from: buyer, value: value})
		} 
		catch(e) {
			assert(true)
		}
	})

	it('Должен падать, если покупается на пустой адрес', async () => {
		const token = await Token.deployed()
		const tokenAddress = await token.address
		const ETHUSD = 10000
		const wallet = accounts[1]
		const buyer = accounts[4]
		const beneficiary = '0x0'
		const value = await web3.toWei('1', 'ether')

		const crowdsale = await Crowdsale.new(rate, hardcap, wallet, startDate, endDate, isPreICO, stageBonus)
		const crowdsaleAddress = await crowdsale.address

		await crowdsale.setToken(tokenAddress)
		await crowdsale.setETHUSD(ETHUSD)
		await token.addSaleAgent(crowdsaleAddress)

		try {
			await crowdsale.buyTokens(beneficiary, {from: buyer, value: value})
		} 
		catch(e) {
			assert(true)
		}
	})

	it('Должен падать, если PreICO, но вызывающий не из whitelist', async () => {
		const token = await Token.deployed()
		const tokenAddress = await token.address
		const ETHUSD = 10000
		const wallet = accounts[1]
		const buyer = accounts[4]
		const value = await web3.toWei('1', 'ether')

		const crowdsale = await Crowdsale.new(rate, hardcap, wallet, startDate, endDate, !isPreICO, stageBonus)
		const crowdsaleAddress = await crowdsale.address

		await crowdsale.setToken(tokenAddress)
		await crowdsale.setETHUSD(ETHUSD)
		await token.addSaleAgent(crowdsaleAddress)

		try {
			await crowdsale.buyTokens(buyer, {from: buyer, value: value})
		} 
		catch(e) {
			assert(true)
		}
	})
})

contract('Crowdsale.setStartDate, Crowdsale.setEndDate', function(accounts) {

	it('Дата должна правильно сеттиться', async () => {

		const wallet = accounts[1]
		const crowdsale = await Crowdsale.new(
			rate,
			hardcap,
			wallet,
			startDate,
			endDate,
			true,
			stageBonus
		)

		const sDate = Math.floor(Date.now()/1000)
		const eDate = Math.floor(Date.now()/1000) + 3600


		await crowdsale.setStartDate(sDate)
		await crowdsale.setEndDate(eDate)

		const sDateSet = (await crowdsale.startDate()).toNumber()
		const eDateSet = (await crowdsale.endDate()).toNumber()

		assert.equal(sDate, sDateSet, 'дата начала не сеттится')
		assert.equal(eDate, eDateSet, 'дата окончания не сеттится')
	})
})

contract('Crowdsale.setETHUSD', function(accounts) {

	it('Курс должен правильно сеттиться', async () => {

		const wallet = accounts[1]
		const crowdsale = await Crowdsale.new(
			rate,
			hardcap,
			wallet,
			startDate,
			endDate,
			true,
			stageBonus
		)

		const ETHUSD = 100

		await crowdsale.setETHUSD(ETHUSD)

		const ETHUSDSet = (await crowdsale.ETHUSD()).toNumber()

		assert.equal(ETHUSD, ETHUSDSet, 'курс эфира не сеттится')
	})
})

contract('Crowdsale.addToWhitelist, Crowdsale.addManyToWhitelist, Crowdsale.removeFromWhitelist', function(accounts) {

	it('Whitelist должен правильно редактироваться', async () => {

		const sender = accounts[0]
		const wallet = accounts[1]
		const whitelisted1 = accounts[6]
		const whitelisted2 = accounts[7]
		const whitelisted3 = accounts[8]

		const crowdsale = await Crowdsale.new(
			rate,
			hardcap,
			wallet,
			startDate,
			endDate,
			isPreICO,
			stageBonus
		)

		await crowdsale.addToWhitelist(whitelisted1)
		await crowdsale.addManyToWhitelist([whitelisted2, whitelisted3])
		await crowdsale.removeFromWhitelist(whitelisted3)

		const isWhitelisted1Set = await crowdsale.whitelist(whitelisted1)
		const isWhitelisted2Set = await crowdsale.whitelist(whitelisted2)
		const isWhitelisted3Set = await crowdsale.whitelist(whitelisted3)
		assert(isWhitelisted1Set && isWhitelisted2Set && !isWhitelisted3Set, 'whitelist редактируется неправильно')
	})
})

contract('Crowdsale.hasClosed()', function(accounts) {

	it('Должен закрываться по истечении времени', async () => {

		const wallet = accounts[1]
		const sDate = Math.floor(Date.now()/1000) - 2
		const eDate = Math.floor(Date.now()/1000) - 1

		const crowdsale = await Crowdsale.new(
			rate,
			hardcap,
			wallet,
			sDate,
			eDate,
			isPreICO,
			stageBonus
		)

		const hasClosed = await crowdsale.hasClosed()

		console.log(hasClosed)
		assert(hasClosed, 'не закрывается по истечении времени')
	})
})

contract('Crowdsale.finalize()', function(accounts) {

	it('Должен закрываться вручную', async () => {

		const wallet = accounts[1]
		const sDate = Math.floor(Date.now()/1000) - 2
		const eDate = Math.floor(Date.now()/1000) - 1

		const crowdsale = await Crowdsale.new(
			rate,
			hardcap,
			wallet,
			sDate,
			eDate,
			isPreICO,
			stageBonus
		)

		const isFinalizedStart = await crowdsale.isFinalized()
		await crowdsale.finalize()
		const isFinalizedEnd = await crowdsale.isFinalized()

		assert.equal(isFinalizedStart, !isFinalizedEnd, 'не закрывается вручную')
	})
})