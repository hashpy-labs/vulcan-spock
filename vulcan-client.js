const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { ethers } = require('ethers');
const transfers1 = require('./transfers-1.json');

const packageDefinition = protoLoader.loadSync('./vulcan.proto', {});
const vulcanPackage = grpc.loadPackageDefinition(packageDefinition).VulcanPackage;

const client = new vulcanPackage.Vulcan('localhost:50051', grpc.credentials.createInsecure());

// Gets the configuration settings of the protocol
client.getConfig(null,  (err, response) => {
	if (err) {
		console.log(err);
	} else {
		console.log(`\nFrom Vulcan`, JSON.stringify(response, null, 2));
	}
});

// Get the circulating supply
client.getCirculatingSupply(null, (err, response) => {
	if (err) {
		console.log(err);
	} else {
		console.log(`\nCirculating Supply`, ethers.utils.commify(response.totalSupply));
	}
});

getBalance('0xTreasury');
getBalance('0xDemo1');
transferBulk(transfers1);
getBalance('0xFirePit');
getBalance('0xInsuranceFund');
getBalance('0xFlex');
getBalance('0xDemo1');
getBalance('0xDemo2');
getBalance('0xDemo3');
getBalance('0xDemo4');



function getBalance(account) {
	// Get the balance of the Treasury account
	client.getBalance({ account: account }, (err, response) => {
		if (err) {
			console.log(err);
		} else {
			console.log(`\nBalance of ${account}`, ethers.utils.commify(response.balance));
		}
	});
}

function transfer(from, to, amount) {
	client.transfer({ from: from, to: to, amount: amount }, (err, response) => {
		if (err) {
			console.log(err);
		} else {
			response.balances[0].balance = ethers.utils.commify(response.balances[0].balance);
			response.balances[1].balance = ethers.utils.commify(response.balances[1].balance);
			console.log(`\nTransfer ${amount} from ${from} to ${to}`, JSON.stringify(response, null, 2));
		}
	});
}

function transferBulk(data) {

	data.forEach((item) => {
		transfer(item.from, item.to, item.amount);
	});
}