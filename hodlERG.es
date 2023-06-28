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
    val bankBoxOut = OUTPUTS(0)
    
    val rcCircIn = bankBoxIn.R4[Long].get
    val devFeeBaseIn = bankBoxIn.R5[Long].get
    val bcReserveIn = bankBoxIn.value
    
    val rcTokensIn = bankBoxIn.tokens(0)._2
    
    val rcCircOut = bankBoxOut.R4[Long].get
    val devFeeBaseOut = bankBoxOut.R5[Long].get
    val bcReserveOut = bankBoxOut.value
    
    val rcTokensOut = bankBoxOut.tokens(0)._2
    
    val totalRcIn = rcTokensIn + rcCircIn
    val totalRcOut = rcTokensOut + rcCircOut

    val tokenIdsConserved = bankBoxOut.tokens(0)._1 == bankBoxIn.tokens(0)._1 && // hodlERG token preserved
                            bankBoxOut.tokens(1)._1 == bankBoxIn.tokens(1)._1    // hodlERG Bank NFT token preserved

    val coinsConserved = totalRcIn == totalRcOut // this check also makes sure R4 is not tampered with

    val devFeeDelta = devFeeBaseIn - devFeeBaseOut

    val isDevFeeWithdrawAction = (devFeeDelta > 0L)

    val bcReserveDelta = if (isDevFeeWithdrawAction) 0L else receiptBox.R5[Long].get

    val validBankValueDelta = bcReserveIn + bcReserveDelta - devFeeDelta == bcReserveOut

    val mandatoryBankConditions =   bankBoxOut.value >= 10000000L &&
                                    bankBoxOut.propositionBytes == bankBoxIn.propositionBytes &&
                                    coinsConserved &&
                                    tokenIdsConserved &&
                                    devFeeBaseIn >= 0L &&
                                    devFeeBaseOut >= 0L &&
                                    validBankValueDelta

    val devFeeWithdrawalConditions = {
        // Dev Fee Withdrawal Action
        val validDevFeeOutput = {
            val devFeeDeltaSplitByThree = (devFeeDelta / 3L)

            // Only allow withdrawal of dev fee if box values are at least 0.001 ERG
            if (devFeeDeltaSplitByThree >= 1000000L) {
                val totalDevFeeSpent = (devFeeDeltaSplitByThree * 3L) //account for rounding

                // split devfee over 3 boxes
                val devFeeBox1 = OUTPUTS(1)
                val devFeeBox2 = OUTPUTS(2)
                val devFeeBox3 = OUTPUTS(3)
                
                // ToDo: On mainnet put in our own address!!

                devFeeDelta == totalDevFeeSpent &&
                //devFeeBox1.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
                devFeeBox1.value == devFeeDeltaSplitByThree &&
                //devFeeBox2.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
                devFeeBox2.value == devFeeDeltaSplitByThree &&
                //devFeeBox3.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
                devFeeBox3.value == devFeeDeltaSplitByThree
            } else false
        }

        validDevFeeOutput &&
        rcTokensOut == rcTokensIn && // token amounts must stay the same
        rcCircOut == rcCircIn // token registers must stay the same
    } 
    
    val mintBurnConditions = {
        // Mint/Burn Action
        val receiptBox = OUTPUTS(1)
        val rcCircDelta = receiptBox.R4[Long].get
        val bcReserveDelta = receiptBox.R5[Long].get

        // Used to calculate true collateral (excl dev fee still in contract)
        val bcReserveInExclFee = bankBoxIn.value - devFeeBaseIn

        val validRcDelta =  (rcCircIn + rcCircDelta == rcCircOut) &&
                            rcCircOut >= 0

        // Exchange Equations
        val brDeltaExpected = { // rc
            val factor = 1000L
            val rcNominalPrice = ((bcReserveInExclFee * factor) / rcCircIn)
            (rcNominalPrice * rcCircDelta) / factor
        }
        
        // Only fee when un-hodling
        val fee = if (brDeltaExpected < 0L) {
            (-brDeltaExpected* 3L) / 100L
        } else 0L

        val brDeltaExpectedWithFee = brDeltaExpected + fee

        // dev fee of 0.3% only on withdrawal
        val validDevFeeDelta = if (brDeltaExpected < 0L) {
            val devFeeTotal = ((-brDeltaExpectedWithFee * 3L) / 1000L)

            // R5 must be incremented by total dev fee of this redemption
            devFeeDelta == - devFeeTotal
        } else {
            // minting action so dev amt must stay the same
            devFeeDelta == 0L
        }

        validRcDelta &&
        bcReserveDelta == brDeltaExpectedWithFee &&
        validDevFeeDelta 
    }

    mandatoryBankConditions && 
    (!isDevFeeWithdrawAction || devFeeWithdrawalConditions) && // if devFeeWithdrawal then its conditions must hold
    (isDevFeeWithdrawAction || mintBurnConditions) // else, the conditions for minting and burning must hold
}
