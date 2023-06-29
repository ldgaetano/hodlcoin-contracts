// Notes:
// * After initialization 1 hodlERG should be burned so circulating supply is never zero.

{
    // Bank box
    //  R4: Number of hodlERG in circulation
    //  R5: Accumulated devFee

    // Receipt box (only if not in the dev fee withdrawal action)
    //  R4: Change of hodlERG in bank box
    //  R5: Change of ERG in bank box     // TODO: Do we really need this?
    
    val bankBoxIn = SELF
    val rcCircIn = bankBoxIn.R4[Long].get
    val devFeeBaseIn = bankBoxIn.R5[Long].get
    val bcReserveIn = bankBoxIn.value - devFeeBaseIn
    val rcTokensIn = bankBoxIn.tokens(0)._2
    
    val bankBoxOut = OUTPUTS(0)
    val rcCircOut = bankBoxOut.R4[Long].get
    val devFeeBaseOut = bankBoxOut.R5[Long].get
    val bcReserveOut = bankBoxOut.value - devFeeBaseOut
    val rcTokensOut = bankBoxOut.tokens(0)._2
    
    val totalRcIn = rcTokensIn + rcCircIn
    val totalRcOut = rcTokensOut + rcCircOut

    // TODO: I think it might be possible to eliminate rcCircIn (and, likewise, rcCircOut), 
    // since rcCircIn is always equal to: the initial amount of RCs in the bank at the moment of deployment 
    // (which is a constant that we know) and the current rcTokensIn.
    // In other words, instead of reading `rcCircIn` from R4, we could do: val rcCircIn = totalConstant - rcTokensIn .
    // Then we would have less risk of inconsistency and would be able to eliminate some conditions.

    val tokenIdsConserved = bankBoxOut.tokens(0)._1 == bankBoxIn.tokens(0)._1 && // hodlERG token preserved
                            bankBoxOut.tokens(1)._1 == bankBoxIn.tokens(1)._1    // hodlERG Bank NFT token preserved

    val coinsConserved = totalRcIn == totalRcOut // this check also makes sure R4 is not tampered with

    val devFeeDelta = devFeeBaseIn - devFeeBaseOut

    val isDevFeeWithdrawAction = (devFeeDelta > 0L)

    val bcReserveDelta = if (isDevFeeWithdrawAction) 0L else receiptBox.R5[Long].get

    val validBankValueDelta = bankBoxIn.value + bcReserveDelta - devFeeDelta == bankBoxOut.value
    // TODO: double check this validity condition

    val mandatoryBankConditions =   bankBoxOut.value >= 10000000L &&
                                    bankBoxOut.propositionBytes == bankBoxIn.propositionBytes &&
                                    coinsConserved &&
                                    tokenIdsConserved &&
                                    devFeeBaseIn >= 0L &&
                                    devFeeBaseOut >= 0L &&
                                    validBankValueDelta

    val devFeeWithdrawalConditions = {
        val devFeeDeltaSplitByThree = (devFeeDelta / 3L)
        val noRoundingError = devFeeDelta == 3L * devFeeDeltaSplitByThree
        val noDust = devFeeDeltaSplitByThree >= 1000000L // Only allow withdrawal of dev fee if box values are at least 0.001 ERG

        val validDevFeeOutputs = {
            // split devfee over 3 boxes
            val devFeeBox1 = OUTPUTS(1)
            val devFeeBox2 = OUTPUTS(2)
            val devFeeBox3 = OUTPUTS(3)
            
            // ToDo: On mainnet put in our own address!!
            //devFeeBox1.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
            devFeeBox1.value == devFeeDeltaSplitByThree &&
            //devFeeBox2.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
            devFeeBox2.value == devFeeDeltaSplitByThree &&
            //devFeeBox3.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
            devFeeBox3.value == devFeeDeltaSplitByThree
        }

        noRoundingError &&
        noDust &&
        validDevFeeOutputs &&
        rcTokensOut == rcTokensIn && // amount of hodlERGs in the bank must stay the same
        rcCircOut == rcCircIn // amount of hodlERGs in circulation must stay the same
    } 
    
    val mintBurnConditions = {
        val receiptBox = OUTPUTS(1)

        // TODO: the reason why we are having to distinguish between mint/burn and devFeeWithdrawal 
        // and have either one or the other is that OUTPUTS(1) is a receiptBox in the former case and 
        // a devFeeBox in the latter case. If we had *always* had a receipt box in OUTPUTS(1) and 
        // the three devFeeBoxes in OUTPUTS(2), OUTPUTS(3) AND OUTPUTS(4), 
        // I think we would be able to simplify the contract further and we would be more flexible/general 
        // (since we would be able to have transactions that mint/burn and distribute devFee simultaneously). 
        // A pure devFee distribution action would be simply a transaction with a receiptBox that has 0 in R4 and R5.

        val rcCircDelta = receiptBox.R4[Long].get

        val validRcDelta =  (rcCircIn + rcCircDelta == rcCircOut) &&
                            rcCircOut >= 0

        // Exchange Equations
        val brDeltaExpected = { // rc  
            val factor = 1000L
            val rcPrice = ((bcReserveIn * factor) / rcCircIn)
            (rcPrice * rcCircDelta) / factor
        }
        
        val isMintAction = brDeltaExpected >= 0L

        // fees paid only when burning
        val fee = if (isMintAction) 0L else (-brDeltaExpected * 3L) / 100L // 3%
        val brDeltaExpectedWithFee = brDeltaExpected + fee // TODO: can't we eliminate this line and replace `brDeltaExpectedWithFee` by `brDeltaExpected` in the line below?
        val devFee = if (isMintAction) 0L else (-brDeltaExpectedWithFee * 3L) / 1000L // 0.3%

        val validDevFeeDelta = devFeeDelta == - devFee

        validRcDelta &&
        bcReserveDelta == brDeltaExpectedWithFee &&
        validDevFeeDelta 
    }

    mandatoryBankConditions && 
    (!isDevFeeWithdrawAction || devFeeWithdrawalConditions) && // if devFeeWithdrawal then its conditions must hold
    (isDevFeeWithdrawAction || mintBurnConditions) // else, the conditions for minting and burning must hold
}
