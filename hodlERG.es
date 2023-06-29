{
    // --- NOTES ---
    // * After initialization 1 hodlERG should be burned so circulating supply is never zero.


    // --- REGISTERS ---
    // Bank box
    // R4: Accumulated devFee


    // --- CONSTANTS ---
    val tokenTotalSupply = 97739924000000000L // Same as ERG
    val preciseFactor = 1000L

    
    // --- LOGIC  ---
    val bankBoxIn = SELF
    val devFeeBaseIn = bankBoxIn.R4[Long].get
    val bcReserveIn = bankBoxIn.value - devFeeBaseIn
    val rcTokensIn = bankBoxIn.tokens(0)._2

    val rcCircIn = tokenTotalSupply - rcTokensIn
    
    val bankBoxOut = OUTPUTS(0)
    val devFeeBaseOut = bankBoxOut.R4[Long].get
    val bcReserveOut = bankBoxOut.value - devFeeBaseOut
    val rcTokensOut = bankBoxOut.tokens(0)._2

    val rcCircOut = tokenTotalSupply - rcTokensOut

    val tokenIdsConserved = bankBoxOut.tokens(0)._1 == bankBoxIn.tokens(0)._1 && // hodlERG token preserved
                            bankBoxOut.tokens(1)._1 == bankBoxIn.tokens(1)._1    // hodlERG Bank NFT token preserved

    val devFeeDelta = devFeeBaseIn - devFeeBaseOut

    val isDevFeeWithdrawAction = (devFeeDelta > 0L)

    val bcReserveDelta = bcReserveOut - bcReserveIn

    val validBankValueDelta = bankBoxIn.value + bcReserveDelta - devFeeDelta == bankBoxOut.value
    // TODO: double check this validity condition

    val mandatoryBankConditions =   bankBoxOut.value >= 10000000L &&
                                    bankBoxOut.propositionBytes == bankBoxIn.propositionBytes &&
                                    tokenIdsConserved &&
                                    devFeeBaseIn >= 0L &&
                                    devFeeBaseOut >= 0L &&
                                    validBankValueDelta

    val devFeeWithdrawalConditions = {
        val devFeeDeltaSplitByThree = (devFeeDelta / 3L)
        val noRoundingError = devFeeDelta == 3L * devFeeDeltaSplitByThree
        val noDust = devFeeDeltaSplitByThree >= 50000000L // Only allow withdrawal of dev fee if box values are at least 0.05 ERG.

        val validDevFeeOutputs = {
            // split devfee over 3 boxes
            val devFeeBox1 = OUTPUTS(1)
            val devFeeBox2 = OUTPUTS(2)
            val devFeeBox3 = OUTPUTS(3)
            
            devFeeBox1.propositionBytes == PK("9hHondX3uZMY2wQsXuCGjbgZUqunQyZCNNuwGu6rL7AJC8dhRGa").propBytes &&  
            devFeeBox1.value == devFeeDeltaSplitByThree &&
            devFeeBox2.propositionBytes == PK("9gnBtmSRBMaNTkLQUABoAqmU2wzn27hgqVvezAC9SU1VqFKZCp8").propBytes &&  
            devFeeBox2.value == devFeeDeltaSplitByThree &&
            devFeeBox3.propositionBytes == PK("9iE2MadGSrn1ivHmRZJWRxzHffuAk6bPmEv6uJmPHuadBY8td5u").propBytes &&  
            devFeeBox3.value == devFeeDeltaSplitByThree
        }

        noRoundingError &&
        noDust &&
        validDevFeeOutputs &&
        rcTokensOut == rcTokensIn // amount of hodlERGs in the bank must stay the same
    } 
    
    val mintBurnConditions = {
        val receiptBox = OUTPUTS(1)

        val rcCircDelta = rcCircOut - rcCircIn

        // Exchange Equations
        val brDeltaExpected = { // rc  
            val rcPrice = ((bcReserveIn * preciseFactor) / rcCircIn)
            (rcPrice * rcCircDelta) / preciseFactor
        }
        
        val isMintAction = rcCircDelta >= 0L

        // fees paid only when burning
        val fee = if (isMintAction) 0L else (-brDeltaExpected * 3L) / 100L // 3%
        val devFee = if (isMintAction) 0L else (-brDeltaExpected * 3L) / 1000L // 0.3%

        val validFeeDelta = bcReserveDelta == (brDeltaExpected + fee) // Needed to ensure the user pays the fee, no?
        val validDevFeeDelta = devFeeDelta == - devFee

        validFeeDelta &&
        validDevFeeDelta
    }

    mandatoryBankConditions && 
    (!isDevFeeWithdrawAction || devFeeWithdrawalConditions) && // if devFeeWithdrawal then its conditions must hold
    (isDevFeeWithdrawAction || mintBurnConditions) // else, the conditions for minting and burning must hold
}