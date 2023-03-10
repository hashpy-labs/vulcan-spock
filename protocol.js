const { uint256 } = require('./go-uint256');

const NULL_ADDRESS = '0x0000';

// Cryptocurrency precision is 18 digits after decimal point
const DECIMAL_RANGE = uint256.Exp(10, 18);//BigNumber.from(10).pow(18)


const MAX_UINT256 = uint256.MAX();
const MILLION = uint256.Exp(10, 6);
const BILLION = uint256.Exp(10, 9);
const PERCENT_DIVISOR = 100;

const BURN_EPOCH_INTERVAL = 4 * 24 * 30 * 3; // Every quarter
const BURN_SUPPLY_THRESHOLD = 51;

const REBASE_DIVISOR = 10 ** 8; // Converts rebase interest rate to correct decimal value
const REBASE_RATE = 1256; // APR = 44%, APY = 55.27%

const MAX_VUL_SUPPLY = uint256.Mul(uint256.Mul(375, BILLION), DECIMAL_RANGE); // 3.75 BILLION
const INITIAL_VUL_SUPPLY = uint256.Mul(uint256.Mul(330, MILLION), DECIMAL_RANGE); // 330 MILLION
const TOTAL_FRAGMENTS = uint256.Sub(MAX_UINT256, uint256.Mod(MAX_UINT256, INITIAL_VUL_SUPPLY));

class Protocol {

    name = 'Vulcan';
    symbol = 'VUL';

    // Receiving accounts
    treasuryAccount;
    flexAccount;
    firePitAccount;

    // All values to be divided by FEE_DIVISOR to get decimal rate
    #treasuryTaxRate;
    #flexTaxRate;
    #firePitTaxRate;


    circulatingSupply;

    #vulsPerFrag;
    #fragBalances = {};

    #epoch = 0;
    #isRebaseActive = true;
    #shouldSlashFirePit = false;


    constructor(options) {
        this.options = options || {};

        this.circulatingSupply = INITIAL_VUL_SUPPLY;
        this.#vulsPerFrag = uint256.Div(TOTAL_FRAGMENTS, this.circulatingSupply);

        this.treasuryAccount = this.options.treasuryAccount;
        this.flexAccount = this.options.flexAccount;
        this.firePitAccount = NULL_ADDRESS;

        this.#treasuryTaxRate = this.options.treasuryTaxRate;
        this.#flexTaxRate = this.options.flexTaxRate;
        this.#firePitTaxRate = this.options.firePitTaxRate;

        // Initialize required accounts
        this.#fragBalances[this.treasuryAccount] = uint256.NewInt(0);
        this.#fragBalances[this.firePitAccount] = uint256.NewInt(0);
        this.#fragBalances[this.flexAccount] = uint256.NewInt(0);

        this._initializeWallets(this.options.genesisAccounts);
    }

    rebase() {

        // Rebasing stops once MaxSupply is reached
        if (this.#isRebaseActive === true) {

            // Destroy FirePit balance on next epich after end of every quarter
            if (this.#epoch % BURN_EPOCH_INTERVAL === 0) {
                this.#shouldSlashFirePit = true;
            }

            // Only rebase after 0th Epoch
            if (this.#epoch > 0) {

                if (this.#shouldSlashFirePit) {
                    this._slashFirePit();
                    this.#shouldSlashFirePit = false;
                }

                this.#isRebaseActive = this._mintCirculatingSupply(
                        uint256.Div(
                            uint256.Mul(
                                this.circulatingSupply,
                                REBASE_RATE
                            ),
                            REBASE_DIVISOR
                    ));

            }
        }

        // Increment the epoch
        this.#epoch++;

        return {
            active: this.#isRebaseActive,
            epoch: this.#epoch - 1,
            circulatingSupply: this.circulatingSupply,
            vulsPerFrag: this.#vulsPerFrag,
            firePitBalance: this._unvirtualize(this.#fragBalances[this.firePitAccount])
        };
    }

    // Handles transfer of funds from one account to another while handling tax
    transfer(from, to, amount) {

        // Convert the amount from the actual to the internal virtual amount
        let vulAmount = this._scaleAndVirtualize(amount);

        // Transfer funds if there is enough balance in the sender's account
        if (this.#fragBalances[from] && uint256.Sub(this.#fragBalances[from], vulAmount).GTE(0)) {

            // Check if the transaction is taxable and if yes, reduce the amount appropriately
            // by transferring funds to the appropriate tax accounts
            if (this._isTaxable(from)) {
                let taxableAmount = vulAmount; // Tax on the starting amount
                vulAmount = uint256.Sub(vulAmount, this._chargeTax(from, taxableAmount, this.treasuryAccount, this.#treasuryTaxRate));
                vulAmount = uint256.Sub(vulAmount, this._chargeTax(from, taxableAmount, this.flexAccount, this.#flexTaxRate));
                vulAmount = uint256.Sub(vulAmount, this._chargeTax(from, taxableAmount, this.firePitAccount, this.#firePitTaxRate));
            }

            // Transfer the post-tax balance from the sender to the recipient
            this.#fragBalances[from] = uint256.Sub(this.#fragBalances[from], vulAmount);
            this.#fragBalances[to] = !this.#fragBalances[to] ? vulAmount : uint256.Add(this.#fragBalances[to], vulAmount);

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

    // Handles transfer of gas payment to nodes
    gasTransfer(from, to, amount) {

        // Convert the amount from the actual to the internal virtual amount
        let vulAmount = this._scaleAndVirtualize(amount);

        // Transfer funds if there is enough balance in the sender's account
        if (this.#fragBalances[from] && uint256.Sub(this.#fragBalances[from], vulAmount).GTE(0)) {

            // Transfer the balance from the sender to the recipient
            this.#fragBalances[from] = uint256.Sub(this.#fragBalances[from], vulAmount);
            this.#fragBalances[to] = !this.#fragBalances[to] ? vulAmount : uint256.Add(this.#fragBalances[to], vulAmount);

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
        return { circulatingSupply: this.circulatingSupply.String() };
    }

    getBalance(account) {
        if (this.#fragBalances[account]) {
            return { account, balance: this._unvirtualize(this.#fragBalances[account]).String() };
        } else {
            return { account, balance: '0' };
        }
    }

    _initializeWallets(accounts) {
        // Set initial balances for all genesis accounts and track total in genesisAmount
        let genesisVulAmount = uint256.NewInt(0);
        Object.keys(accounts).forEach((account) => {
            this.#fragBalances[account] = this._scaleAndVirtualize(accounts[account]);
            genesisVulAmount = uint256.Add(genesisVulAmount, this.#fragBalances[account]);
            console.log(`\nBalance of ${account}`, uint256.Commify(this._unvirtualize(this.#fragBalances[account])));
        });

        // All unused amount goes to the Fire Pit
        this.#fragBalances[this.firePitAccount] = uint256.Sub(this._virtualize(this.circulatingSupply), genesisVulAmount);
    }

    _slashFirePit() {
        let destroyThresholdAmount = uint256.Div(uint256.Mul(this.circulatingSupply, BURN_SUPPLY_THRESHOLD), PERCENT_DIVISOR);
        const firePitAmount = this._unvirtualize(this.#fragBalances[this.firePitAccount]);
        if (firePitAmount.GTE(destroyThresholdAmount)) {
            let destroyTargetAmount = uint256.Div(uint256.Mul(this.circulatingSupply, BURN_SUPPLY_THRESHOLD - 2), PERCENT_DIVISOR);
            this._burnCirculatingSupply(this.firePitAccount, destroyTargetAmount);
        }
    }

    _mintCirculatingSupply(amount) {
        if (uint256.Add(this.circulatingSupply, amount).LTE(MAX_VUL_SUPPLY)) {
            this.circulatingSupply = uint256.Add(this.circulatingSupply, amount);

            // IMPORTANT: Only change vulsPerFrag after modifying account balances
            this.#vulsPerFrag = uint256.Div(TOTAL_FRAGMENTS, this.circulatingSupply);
            return true;    
        }
        return false;
    }

    _burnCirculatingSupply(account, amount) {        
        console.log('Burn', uint256.Commify(amount))
        // VAPORIZE, NUKE, ANNIHILATE

        const virtualizedAmount = this._virtualize(amount);
        this.circulatingSupply = uint256.Sub(this.circulatingSupply, amount);
        console.log(account, uint256.Commify(this._unvirtualize(this.#fragBalances[account])), uint256.Commify(amount))
        this.#fragBalances[account] = uint256.Sub(this.#fragBalances[account], virtualizedAmount);
        console.log(account, uint256.Commify(this._unvirtualize(this.#fragBalances[account])), uint256.Commify(amount))

        // NOTE: This code is currently reporting FirePit balance incorrectly

        // IMPORTANT: Only change vulsPerFrag after modifying account balances
        this.#vulsPerFrag = uint256.Div(TOTAL_FRAGMENTS, this.circulatingSupply);
    }

    _scaleAndVirtualize(num) {
        return uint256.Mul(this._scale(num), this.#vulsPerFrag);
    }

    _virtualize(num) {
        return uint256.Mul(num, this.#vulsPerFrag);
    }

    _unvirtualize(num) {
        return uint256.Div(num, this.#vulsPerFrag);
    }

    _scale(num) {
        return uint256.Mul(num, DECIMAL_RANGE);
    }

    // Helper function which transfers the tax from the sender account to the tax account
    _chargeTax(senderAccount, amount, taxAccount, taxRate) {

        let tax = uint256.NewInt(0);
        if (taxRate > 0) {
            tax = uint256.Div(uint256.Mul(amount, taxRate), PERCENT_DIVISOR);
            this.#fragBalances[senderAccount] = uint256.Sub(this.#fragBalances[senderAccount], tax);
            this.#fragBalances[taxAccount] = uint256.Add(this.#fragBalances[taxAccount], tax);
        }
        return tax;
    }
    // Helper function to detemine if tax should be levied based on the sender and recipient
    _isTaxable(from) {

        // Define conditions for skipping tax
        if (from == this.treasuryAccount) return false;
        if (from == this.flexAccount) return false;
        if (from == this.firePitAccount) return false;

        return this.#isRebaseActive;
    }

}

module.exports.Protocol = Protocol;