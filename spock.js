const { BigNumber } = require('@ethersproject/bignumber');
const { ethers } = require('ethers');

const MAX_UINT256 = ethers.constants.MaxUint256;

const DECIMALS = 18;
const DECIMAL_RANGE = BigNumber.from(10).pow(DECIMALS)
const MILLION = BigNumber.from(10).pow(6);
const FEE_DIVISOR = 1000000;

const EPOCH_SECONDS = 15 * 60; // 15 minutes in seconds
const REBASE_RATE_CHANGE_EPOCH = 240 * 24 * 4; // 240 days x 24 hours x 4 epochs per hour

const INITIAL_REBASE_RATE = 21580;

const MAX_VUL_SUPPLY = BigNumber.from(3250).mul(MILLION).mul(DECIMAL_RANGE); // 3.25 BILLION
const INITIAL_VUL_SUPPLY = BigNumber.from(325).mul(MILLION).mul(DECIMAL_RANGE); // 325 MILLION

const TOTAL_FRAGS = MAX_UINT256.sub(MAX_UINT256.mod(INITIAL_VUL_SUPPLY));


class Spock {
    
    name = 'Vulcan';
    symbol = 'VUL';

    // All values to be divided by FEE_DIVISOR to get percentage
    #treasuryFee = 20000;
    #firePitFee = 50000;
    #insuranceFundFee = 10000;
    #flexFee = 20000;


    // Receiving accounts
    treasuryAccount;
    firePitAccount;
    insuranceFundAccount;
    flexAccount;

    totalSupply;

    #vulBalances = {};

    #epoch = 0;


    constructor(options) {
        this.options = options || {};
        this.timestamp = this.options.genesisTimestamp; 

        this.totalSupply = INITIAL_VUL_SUPPLY;

        this.totalFee = this.treasuryFee + this.insuranceFundFee + this.firePitFee + this.flexFee;
        
        this.treasuryAccount = this.options.treasuryAccount;
        this.firePitAccount = this.options.firePitAccount;
        this.insuranceFundAccount = this.options.insuranceFundAccount;
        this.flexAccount = this.options.flexAccount;
        this.deadAccount = '0xDead'

        this.#vulBalances[this.treasuryAccount] = TOTAL_FRAGS;
    }

    _tax(sourceAccount, amount, taxAccount, taxRate) {

        if (rate > 0) {
            let tax = amount.mul(taxRate).div(FEE_DIVISOR);
            console.log('In _tax', amount.toString(),  tax.toString(), taxRate)
            this.#vulBalances[sourceAccount] = this.#vulBalances[sourceAccount].sub(tax);
            this.#vulBalances[taxAccount] = this.#vulBalances[taxAccount].add(tax);
        }
        return tax;
    }

    transfer(from, to, amount) {
        const protocolParams = this.getProtocolParams();

        const vulAmount = BigNumber.from(amount).mul(DECIMAL_RANGE).mul(protocolParams.vulsPerFrag);
        if (this.#vulBalances[from].sub(vulAmount) >= 0) {

            // Tax — Work in Progress so set to force skip
            // const skipTax = true || (to == this.treasuryAccount) || (to == this.firePitAccount) || (to == this.insuranceFundAccount) || (to == this.flexAccount);

            // if (!skipTax) {
            //     vulAmount = vulAmount.sub(this._tax(from, vulAmount, this.treasuryAccount, protocolParams.treasuryFee));
            //     vulAmount = vulAmount.sub(this._tax(from, vulAmount, this.firePitAccount, protocolParams.firePitFee));
            //     vulAmount = vulAmount.sub(this._tax(from, vulAmount, this.insuranceFundAccount, protocolParams.insuranceFundFee));
            //     vulAmount = vulAmount.sub(this._tax(from, vulAmount, this.flexAccount, protocolParams.flexFee));
            // }            

            this.#vulBalances[from] = this.#vulBalances[from].sub(vulAmount);

            if (!this.#vulBalances[to]) {
                this.#vulBalances[to] = BigNumber.from(0);
            }
            this.#vulBalances[to] = this.#vulBalances[to].add(vulAmount);

        } else {
            throw new Error("Insufficient balance")
        }

        return {
            balances: [
                this.getBalance(from),
                this.getBalance(to)
            ]
        } 
    }

    getCirculatingSupply() {
        return {totalSupply: this.totalSupply};
    }

    getBalance(account) {
        const protocolParams = this.getProtocolParams();
        if (this.#vulBalances[account]) {
            return {account, balance: this.#vulBalances[account].div(protocolParams.vulsPerFrag)};
        } else {
            return {account, balance: 0};
        }
    }

    /**
     * 
     * @param {*} epoch The current epoch
     * @returns object containing current rebase and fee values
     */
    getProtocolParams() {

        let rebaseRate = INITIAL_REBASE_RATE;
        
        // Change values after initial period of 240 days
        if (this.#epoch > REBASE_RATE_CHANGE_EPOCH) {

            //TODO: Set accurate values
            rebaseRate = 0;
            this.#treasuryFee = 0;
            this.#firePitFee = 0;
            this.#insuranceFundFee = 0;
            this.#flexFee = 0;
        }

        return {
            rebaseRate: BigNumber.from(rebaseRate),
            treasuryFee: this.#treasuryFee,
            firePitFee: this.#firePitFee,
            insuranceFundFee: this.#insuranceFundFee,
            flexFee: this.#flexFee,
            vulsPerFrag: TOTAL_FRAGS.div(this.totalSupply)
        }
    }

    // Increment time to next epoch
    incrementEpoch() {
        this.timestamp += EPOCH_SECONDS;
    }

    rebase() {

        // First increment epoch        
        this.#epoch++;

        // Change total supply
        const protocolParams = this.getProtocolParams();
        this.totalSupply = this.totalSupply.add(protocolParams.rebaseRate.mul(DECIMAL_RANGE));

        return { epoch: this.#epoch, timestamp: this.timestamp, totalSupply: this.totalSupply };
    }

    getConfig() {
        return{
            name: this.name,
            symbol: this.symbol,

            DECIMALS, 
            'MAX_UINT256': ethers.utils.commify(MAX_UINT256), 
            'MAX_VUL_SUPPLY': ethers.utils.commify(MAX_VUL_SUPPLY),
            'INITIAL_VUL_SUPPLY': ethers.utils.commify(INITIAL_VUL_SUPPLY), 
            'TOTAL_FRAGS': ethers.utils.commify(TOTAL_FRAGS),

            treasuryAccount: this.treasuryAccount,
            firePitAccount: this.firePitAccount,
            insuranceFundAccount: this.insuranceFundAccount,
            flexAccount: this.flexAccount,
            deadAccount: this.deadAccount, 

            treasuryFee: this.#treasuryFee, 
            firePitFee: this.#firePitFee,
            insuranceFundFee: this.#insuranceFundFee, 
            flexFee: this.#flexFee
        };
    }

}

module.exports.Spock = Spock;


