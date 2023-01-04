# Spock Simulator for Vulcan Protocol

Spock is a simulator for Vulcan Protocol that enables what-if scenarios to project how the rebasing protocol will impact transactions. It is implemented as a gRPC server and client.

### Current Status

The basic simulator is operational with the following RPC calls available:
- getConfig
- getBalance
- getCirculatingSupply
- transfer

### Configuration

The simulator runs by rebasing every N milliseconds representing 15 mins in real time. This is configurable by changing `EPOCH_INTERVAL_MSEC` in `vulcan-server.js`.

Many operational aspects are configurable via `config.json`.

### Usage

`npm install`

Terminal window 1: `npm run vserver`
Terminal window 2: `npm run vclient`

(Optional)
Terminal window 3: `npm run vbalances` (returns balances of main and demo accounts without any transactions)

### Protocol Information

- Auto Rebase every 15 minute epoch
- Fixed APY Rebase (Introductory Promotional Rate)
- Fixed 8 month intro rebase rewards set at 191,888% APY
- TAX: Buy/Sell/Transfer on chain: 10% (Any and all
- SafuuX Coin TX’s), all other tokens; subject to 0 tax.
- 5% SafuuX FirePit - NULL 0xdead address
- 1% SafuuX Insurance Fund (SIF)
- 2% SafuuX Treasury
- 2% Flexible Rebase Component

- “FixedFlex” APY (Continual after the first 240 days have passed)
- FIXED: 38.0% Fixed APR Rebase
- FLEX: 3.14% Pi Reward per day maximum is set for the Flexible Reward Component. Reward is paid from TX fees alone without incurring rebase. Any additional rewards are burnt directly into the SafuuX Fire Pit
- Total APY % = FIXED + FLEX (Dependent on chain volume)
- Maximum Achievable FixedFlex Percentage = 3.24% Daily
