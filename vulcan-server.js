const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { ethers } = require('ethers');
const config = require('./config.json');
const { Spock } = require('./spock');

const packageDefinition = protoLoader.loadSync('./vulcan.proto', {});
const vulcanPackage = grpc.loadPackageDefinition(packageDefinition).VulcanPackage;

const EPOCH_INTERVAL_MSEC = 1000;

// Create the RPC server
const server = new grpc.Server();

// Initialize the Spock simulator
const spock = new Spock(config);

// Add the service
server.addService(vulcanPackage.Vulcan.service, {
	'getConfig': getConfig,
	'getBalance': getBalance,
	'getCirculatingSupply': getCirculatingSupply,
	'transfer': transfer
});

server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), async () => {
	console.log("Vulcan Protocol running at http://127.0.0.1:50051");
	server.start();

    await new Promise(resolve => setInterval(() => { 
        
		spock.incrementEpoch()
        let rebaseInfo = spock.rebase();
        console.info(
            'Epoch: ' + String(rebaseInfo.epoch).padStart(12, '0'), 
            '\t',
            '🕰: ' + new Date(rebaseInfo.timestamp * 1000).toISOString().replace(':00.000Z','').replace('T',' '),
			'\t',
			'🪙: ' + ethers.utils.commify(rebaseInfo.totalSupply)
        );
    }, EPOCH_INTERVAL_MSEC));

}); // Server is insecure, no ssl



function getConfig(call, callback) {
	callback(null, spock.getConfig());
}

function getBalance(call, callback) {
	callback(null, spock.getBalance(call.request.account));
}

function getCirculatingSupply(call, callback) {
	callback(null, spock.getCirculatingSupply());
}

function transfer(call, callback) {
	const result = spock.transfer(call.request.from, call.request.to, call.request.amount);
	callback(null, result);

	console.info(`\nTransfer — amount: ${ethers.utils.commify(call.request.amount)}`);
	console.info(`Transfer (After)  — from: ${call.request.from} (${ethers.utils.commify(result.balances[0].balance)}) to: ${call.request.to} (${ethers.utils.commify(result.balances[1].balance)})\n`);
}



