{

    // ===== Contract Information ===== //
    // Name: Hodl ERG
    // Description: Contract rewrite and the original hodlERG.es contract found here: https://github.com/pulsarz/hodlcoin-contracts/blob/f9191ce68275a976461af54aa16c85db5ed383bf/hodlERG.es

    // ===== Box Contents ===== //
    // Tokens
    // 1. (HodlERGTokenId, TokenTotalSupply)
    // 2. (HodlERGBankSingleton, 1)
    // Registers
    // R4: Long TreasuryAmount

    // ===== Relevant Transactions ===== //
    // 1. Mint Tx
    // Inputs: Bank, UserPK
    // DataInputs: None
    // Outputs: Bank, UserPK
    // Context Variables: None
    // 2. Burn Tx
    // Inputs: Bank, UserPK
    // DataInputs: None
    // Outputs: Bank, UserPK
    // Context Variables: None
    // 3. Treasury Withdraw Tx
    // Inputs: Bank
    // DataInputs: None
    // Outptus: Bank, Dev1, Dev2, Dev3
    // Context Variables: None

    // ===== Compile Time Constants ($) ===== //
    // None

    // ===== Context Variables (@) ===== //
    // None

    // ===== Relevant Variables ===== //
    val tokenTotalSupply: Long = 97739924000000000L             // Same as ERG total supply
    val precisionFactor: Long = 1000L
    val fee: Long = (precisionFactor * 3L) / 100L               // 3% bank fee applied when burning hodlERG
    val devFee: Long = (precisionFactor * 3L) / 1000L           // 0.3% dev fee applied when burning hodlERG
    
    val treasuryIn: Long = SELF.R4[Long].get                    // The value of the treasury accumulated from fees
    val reserveIn: Long = SELF.value - treasuryIn               // Actual reserve minus treasury, since ERG is used for both
    val hodlCoinsIn: Long = SELF.tokens(0)._2                   // hodlERG token amount in the bank box
    val hodlCoinsCircIn: Long = tokenTotalSupply - hodlCoinsIn  // hodlERG in circulation since this value represents what is not inside the box

    // Outputs
    val bankBoxOUT: Box = OUTPUTS(0)
    val treasuryOUT: Long = bankBoxOUT.R4[Long].get
    val reserveOUT: Long = bankBoxOUT.value - treasuryOut 
    val hodlCoinsOUT: Long = bankBoxOUT.tokens(0)._2
    val hodlCoinsCircOUT: Long = tokenTotalSupply - hodlCoinsOut

    val reserveDelta: Long = reserveOut - reserveIn
    val treasuryDelta: Long = treasuryOut - treasuryIn 
    val hodlCoinsCircDelta: Long = hodlCoinsCircOut - hodlCoinsCircIn 

    val isMintTx: Boolean = (hodlCoinsCircDelta >= 0L)
    val isTreasuryWithdrawTx: Boolean = (treasuryDelta < 0L)

    val validGeneralConditions: Boolean = {

        val validValue: Boolean = (bankBoxOUT.value >= 10000000L)
        
        val validContract: Boolean = (bankBoxOUT.propositionBytes == SELF.propositionBytes)
        
        val validTokenIds: Boolean = {

            allOf(Coll(
                (bankBoxOUT.tokens(0)._1 == SELF.tokens(0)._1),
                (bankBoxOUT.tokens(1)._1 == SELF.tokens(1)._1)
            ))

        }

        val validTreasuryNeverNegative: Boolean = {
        
            allOf(Coll(
                (treasuryIn >= 0L),
                (treasuryOut >= 0L)
            ))
        
        }
        
        allOf(Coll(
            validValue,
            validBankContract,
            validTokenIds,
            validTreasuryNeverNegative
        ))

    }

    if (isMintTx) {

        // ===== Mint Tx ===== //
        val validMintTx: Boolean = {

            // Outputs
            val bankBoxOUT: Box = OUTPUTS(0)

            val price: Long = ((reserveIn * precisionFactor) / hodlCoinsCircIn)
            val expectedAmountDeposited: Long = hodlCoinsCircDelta * price / precisionFactor
            
            val validReserveDelta: Boolean = (reserveDelta == expectedAmountDeposited)
            val validTreasuryDelta: Boolean = (treasuryDelta == 0L)

            allOf(Coll(
                validGeneralConditions,
                validReserveDelta,
                validTreasuryDelta
            ))

        }

        sigmaProp(validMintTx)

    } else if (isTreasuryWithdrawTx) {

        // ===== Treasury Withdraw Tx ===== //
        val validTreasuryWithdrawTx: Boolean = {

            // Outputs
            val dev1: Box = OUTPUTS(1)
            val dev2: Box = OUTPUTS(2)
            val dev3: Box = OUTPUTS(3)

            val amountPerDev: Long = - (treasuryDelta / 3L)

            val validNoRoundingError: Boolean = (treasuryDelta == -3L * amountPerDev)
            val validNoDust: Boolean = (amountPerDev >= 50000000L) // Only allow withdrawal of dev fee if box values are at least 0.05 ERG.

            val validBank: Boolean = {

                val validReserves: Boolean = (reserveDelta == 0L)
                val validHodlCoinsAmount: Boolean = (hodlCoinsOut == hodlCoinsIn)

                allOf(
                    validReserves,
                    validHodlCoinsAmount
                )

            }

            val validDevs: Boolean = {

                allOf(Coll(
                    (dev1.value == amountPerDev),
                    (dev1.propositionBytes == PK("9hHondX3uZMY2wQsXuCGjbgZUqunQyZCNNuwGu6rL7AJC8dhRGa").propBytes),
                    (dev2.value == amountPerDev),
                    (dev2.propositionBytes == PK("9gnBtmSRBMaNTkLQUABoAqmU2wzn27hgqVvezAC9SU1VqFKZCp8").propBytes),
                    (dev3.value == amountPerDev),
                    (dev3.propositionBytes == PK("9iE2MadGSrn1ivHmRZJWRxzHffuAk6bPmEv6uJmPHuadBY8td5u").propBytes)
                ))
                
            }

            allOf(Coll(
                validGeneralConditions,
                validNoRoundingError,
                validNoDust,
                validBank,
                validDevs
            ))

        }

        sigmaProp(validTreasuryWithdrawTx)

    } else {

        // ===== Burn Tx ===== //
        val validBurnTx: Boolean = {

            val hodlCoinsBurned: Long = hodlCoinsCircIn - hodlCoinsCircOut 
            val price: Long = (reserveIn * precisionFactor) / hodlCoinsCircIn
            val expectedAmountBeforeFees: Long = (hodlCoinsBurned * price) / precisionFactor
            val feeAmount: Long = (expectedAmountBeforeFees * fee) / precisionFactor
            val devFeeAmount: Long = (expectedAmountBeforeFees * devFee) / precisionFactor
            val expectedAmountWithdrawn: Long = expectedAmountBeforeFees - feeAmount - devFeeAmount

            val validReserveDelta: Boolean = (reserveDelta == - expectedAmountWithdrawn - devFeeAmount)
            val validTreasuryDelta: Boolean = (treasuryDelta == devFeeAmount)

            allOf(Coll(
                validGeneralConditions,
                validReserveDelta,
                validTreasuryDelta
            ))

        }

        sigmaProp(validBurnTx)

    }

}