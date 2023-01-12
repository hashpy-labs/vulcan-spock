const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const { uint256 } = require('./go-uint256');
const config = require('./config.json');
const { Protocol } = require('./protocol');

const packageDefinition = protoLoader.loadSync('./vulcan.proto', {});
const vulcanPackage = grpc.loadPackageDefinition(packageDefinition).VulcanPackage;

// CHANGE THIS VALUE TO SPEED UP EPOCHS IN SIMULATOR
const EPOCH_INTERVAL_MSEC = 1; // Can be any value for simulator...smaller = faster


const EPOCH_SECONDS = 15 * 60; // 15 minutes in seconds

// Create the RPC server
const server = new grpc.Server();

// Initialize the protocol simulator
const protocol = new Protocol(config);

// Add the service
server.addService(vulcanPackage.Vulcan.service, {
	'getBalance': getBalance,
	'transfer': transfer,
	'gasTransfer': gasTransfer,
	'getCirculatingSupply': getCirculatingSupply
});

server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), async () => {
	console.log("Vulcan Protocol running at http://127.0.0.1:50051");
	server.start();
	
	let timestamp = 1672531200; // 1/1/2023 00:00:00

	await new Promise(resolve => setInterval(() => { 
        
		     
        let rebaseInfo = protocol.rebase();

		console.info(
			'\nEpoch:\t' + String(rebaseInfo.epoch).padStart(12, '0'), 
			'\t',
			new Date(timestamp * 1000).toISOString().replace(':00.000Z','').replace('T',' '),
			'\n',
			'🪙\t' + uint256.Commify(rebaseInfo.circulatingSupply),
			'\n',
			'🔥\t' + uint256.Commify(rebaseInfo.firePitBalance),
			'\n',
			'🚀\tRebasing ' + (rebaseInfo.active ? 'ACTIVE' : 'ENDED')
		);

		timestamp += EPOCH_SECONDS;


    }, EPOCH_INTERVAL_MSEC));

}); // Server is insecure, no ssl


function getBalance(call, callback) {
	callback(null, protocol.getBalance(call.request.account));
}

function getCirculatingSupply(call, callback) {console.log(protocol.getCirculatingSupply())
	callback(null, protocol.getCirculatingSupply());
}

function transfer(call, callback) {
	const result = protocol.transfer(call.request.from, call.request.to, call.request.amount);
	callback(null, result);

	console.info(`\nTransfer\tamount: ${uint256.Commify(call.request.amount)}\n\t\tfrom: ${call.request.from} (${uint256.Commify(result.balances[0].balance)}) \n\t\tto: ${call.request.to} (${uint256.Commify(result.balances[1].balance)})\n`);
}


function gasTransfer(call, callback) {
	const result = protocol.gasTransfer(call.request.from, call.request.to, call.request.amount);
	callback(null, result);

	console.info(`\nGas Transfer\tamount: ${uint256.Commify(call.request.amount)}\n\t\tfrom: ${call.request.from} (${uint256.Commify(result.balances[0].balance)}) \n\t\tto: ${call.request.to} (${uint256.Commify(result.balances[1].balance)})\n`);
}



