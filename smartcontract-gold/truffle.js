module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  networks: {
        development: {
	      	  host: "127.0.0.1",
  			    port: 8545,
            network_id: "*",
            before_timeout: 300,             //  <=== NEW
            test_timeout: 300,                //  <=== NEW
            gas: 9999999999
        }
    }
};
