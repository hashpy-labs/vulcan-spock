# Spock Simulator for Vulcan Protocol

Spock is a simulator for Vulcan Protocol that enables what-if scenarios to project how the rebasing protocol will impact transactions. It is implemented as a gRPC server and client.

### Current Status

The basic simulator is operational with the following RPC calls available:
- getBalance
- getCirculatingSupply
- transfer
- gasTransfer

### Configuration

The simulator runs by rebasing every N milliseconds representing 15 mins in real time. This is configurable by changing `EPOCH_INTERVAL_MSEC` in `vulcan-server.js`.

Many operational aspects are configurable via `config.json`.

### Usage

`npm install`

Terminal window 1: `npm run vserver`
Terminal window 2: `npm run vclient`

(Optional)
Terminal window 3: `npm run vbalances` (returns balances of main and demo accounts without any transactions)

