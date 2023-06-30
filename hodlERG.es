{
    // --- NOTES ---
    // * tokens(0) in the BankBox is the hodlERG token
    // * After initialization 1 hodlERG token should be burned so circulating supply is never zero.


    // --- REGISTERS ---
    // BankBox
    // R4: devTreasury where devFees are accumulated until withdrawn


    // --- CONSTANTS ---
    val tokenTotalSupply = 97739924000000000L // Same as ERG
    val precisionFactor = 1000L

    
    // --- LOGIC  ---
    val bankBoxIn = SELF
    val devTreasuryIn = bankBoxIn.R4[Long].get
    val reserveIn = bankBoxIn.value - devTreasuryIn
    val hodlCoinsIn = bankBoxIn.tokens(0)._2  // hodlCoins in the BankBox
    val hodlCoinsCircIn = tokenTotalSupply - hodlCoinsIn // hodlCoins in circulation
    
    val bankBoxOut = OUTPUTS(0)
    val devTreasuryOut = bankBoxOut.R4[Long].get
    val reserveOut = bankBoxOut.value - devTreasuryOut
    val hodlCoinsOut = bankBoxOut.tokens(0)._2
    val hodlCoinsCircOut = tokenTotalSupply - hodlCoinsOut

    val tokenIdsConserved = bankBoxOut.tokens(0)._1 == bankBoxIn.tokens(0)._1 && // hodlERG token preserved
                            bankBoxOut.tokens(1)._1 == bankBoxIn.tokens(1)._1    // hodlERG Bank NFT token preserved

    val amountWithdrawnFromTreasury = devTreasuryIn - devTreasuryOut

    val isDevFeeWithdrawAction = (amountWithdrawnFromTreasury > 0L)

    val reserveDelta = reserveOut - reserveIn

    val validBankValueDelta = bankBoxIn.value + reserveDelta - amountWithdrawnFromTreasury == bankBoxOut.value
    // TODO: double check this validity condition

    val bankConditions = bankBoxOut.value >= 10000000L &&
                        bankBoxOut.propositionBytes == bankBoxIn.propositionBytes &&
                        tokenIdsConserved &&
                        devTreasuryIn >= 0L &&
                        devTreasuryOut >= 0L &&
                        validBankValueDelta

    val devFeeWithdrawalConditions = {
        val amountWithdrawnFromTreasurySplitByThree = (amountWithdrawnFromTreasury / 3L)
        val noRoundingError = amountWithdrawnFromTreasury == 3L * amountWithdrawnFromTreasurySplitByThree
        val noDust = amountWithdrawnFromTreasurySplitByThree >= 50000000L // Only allow withdrawal of dev fee if box values are at least 0.05 ERG.

        val validDevFeeOutputs = {
            // split devfee over 3 boxes
            val devFeeBox1 = OUTPUTS(1)
            val devFeeBox2 = OUTPUTS(2)
            val devFeeBox3 = OUTPUTS(3)
            
            devFeeBox1.propositionBytes == PK("9hHondX3uZMY2wQsXuCGjbgZUqunQyZCNNuwGu6rL7AJC8dhRGa").propBytes &&  
            devFeeBox1.value == amountWithdrawnFromTreasurySplitByThree &&
            devFeeBox2.propositionBytes == PK("9gnBtmSRBMaNTkLQUABoAqmU2wzn27hgqVvezAC9SU1VqFKZCp8").propBytes &&  
            devFeeBox2.value == amountWithdrawnFromTreasurySplitByThree &&
            devFeeBox3.propositionBytes == PK("9iE2MadGSrn1ivHmRZJWRxzHffuAk6bPmEv6uJmPHuadBY8td5u").propBytes &&  
            devFeeBox3.value == amountWithdrawnFromTreasurySplitByThree
        }

        noRoundingError &&
        noDust &&
        validDevFeeOutputs &&
        hodlCoinsOut == hodlCoinsIn // amount of hodlERGs in the bank must stay the same
    } 
    
    val mintBurnConditions = {
        val receiptBox = OUTPUTS(1)

        val hodlCoincCircDelta = hodlCoinsCircOut - hodlCoinsCircIn

        val hodlCoincCircDeltaExpected = {  
            val rcPrice = ((reserveIn * precisionFactor) / hodlCoinsCircIn)
            (rcPrice * hodlCoincCircDelta) / precisionFactor
        }
        
        val isMintAction = hodlCoincCircDelta >= 0L

        // fees paid only when burning
        val fee = if (isMintAction) 0L else (-hodlCoincCircDeltaExpected * 3L) / 100L // 3%
        val devFeeExpected = if (isMintAction) 0L else (-hodlCoincCircDeltaExpected * 3L) / 1000L // 0.3%

        val validFeeDelta = reserveDelta == (hodlCoincCircDeltaExpected + fee) // Needed to ensure the user pays the fee, no?
        val validDevFeeDelta = amountWithdrawnFromTreasury == - devFeeExpected // TODO: BUG FIXME

        validFeeDelta &&
        validDevFeeDelta
    }

    bankConditions && 
    (!isDevFeeWithdrawAction || devFeeWithdrawalConditions) && // if devFeeWithdrawal then its conditions must hold
    (isDevFeeWithdrawAction || mintBurnConditions) // else, the conditions for minting and burning must hold
}