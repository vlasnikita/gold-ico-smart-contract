var Token = artifacts.require("Token.sol");
var Crowdsale = artifacts.require("Crowdsale.sol");

module.exports = function(deployer) {
  deployer.deploy(Token);
  deployer.deploy(Crowdsale, 10, 5000000, web3.eth.accounts[0], 1523785498, 1523985498, false, 10);
};