Notes:
* After initialization 1 hodlERG should be burned so circulating supply is never zero.

{
    //Bank box
    // R4: Number of hodlERG in circulation

    //Receipt box (only if not in the dev fee withdrawal action)
    // R4: Change of hodlERG in bank box
    // R5: Change of ERG in bank box
    
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

    val tokenIdsConserved = bankBoxOut.tokens(0)._1 == bankBoxIn.tokens(0)._1 && // also ensures that at least one token exists
                            bankBoxOut.tokens(1)._1 == bankBoxIn.tokens(1)._1    // also ensures that at least one token exists

    val coinsConserved = totalRcIn == totalRcOut

    val mandatoryBankConditions =   bankBoxOut.value >= 10000000L &&
                                    bankBoxOut.propositionBytes == bankBoxIn.propositionBytes &&
                                    coinsConserved &&
                                    tokenIdsConserved &&
                                    devFeeBaseIn >= 0L &&
                                    devFeeBaseOut >= 0L

    if (devFeeBaseOut < devFeeBaseIn) {
        //dev fee withdrawal
        val validBankValueDelta = (bcReserveIn - (devFeeBaseIn - devFeeBaseOut) == bcReserveOut)

        val validDevFeeOutput = if (devFeeBaseOut < devFeeBaseIn) {
            val devFeeAccumulatedSplitByThree = ((devFeeBaseIn - devFeeBaseOut) / 3L)

            //Only allow withdrawal of dev fee if box values are at least 0.001 ERG
            if (devFeeAccumulatedSplitByThree >= 1000000L) {
                val totalDevFeeSpent = (devFeeAccumulatedSplitByThree * 3L)//needed for rounding errors?

                //split devfee over 3 boxes
                val devFeeBox1 = OUTPUTS(1)
                val devFeeBox2 = OUTPUTS(2)
                val devFeeBox3 = OUTPUTS(3)
                
                //ToDo: On mainnet put in our own address!!
                

                (devFeeBaseIn - devFeeBaseOut) == totalDevFeeSpent &&
                //devFeeBox1.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
                devFeeBox1.value == devFeeAccumulatedSplitByThree &&
                //devFeeBox2.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
                devFeeBox2.value == devFeeAccumulatedSplitByThree &&
                //devFeeBox3.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
                devFeeBox3.value == devFeeAccumulatedSplitByThree
            } else false
        } else false

        validDevFeeOutput &&
        mandatoryBankConditions &&
        rcTokensOut == rcTokensIn &&//token registers must stay the same
        validBankValueDelta
    } else {
        //Normal mint/redeem

        val receiptBox = OUTPUTS(1)
        val rcCircDelta = receiptBox.R4[Long].get
        val bcReserveDelta = receiptBox.R5[Long].get

        val validBankValueDelta = bcReserveIn + bcReserveDelta == bcReserveOut

        //Used to calculate true collateral (excl dev fee still in contract)
        val bcReserveInExclFee = bankBoxIn.value - devFeeBaseIn

        val validRcDelta =  (rcCircIn + rcCircDelta == rcCircOut) &&
                            rcCircOut >= 0

        // exchange equations
        val brDeltaExpected = { // rc
            val factor = 1000L
            val rcNominalPrice = ((bcReserveInExclFee * factor) / rcCircIn)
            (rcNominalPrice * rcCircDelta) / factor
        }
        
        //Only fee when un-hodling
        val fee = if (brDeltaExpected < 0L) {
            (-brDeltaExpected* 3L) / 100L
        } else 0L

        val brDeltaExpectedWithFee = brDeltaExpected + fee

        //dev fee of 0.3% only on withdrawal
        val validDevFeeDelta = if (brDeltaExpected < 0L) {
            val devFeeTotal = ((-brDeltaExpectedWithFee * 3L) / 1000L)

            //R5 must be incremented by total dev fee of this redemption
            devFeeBaseOut == (devFeeBaseIn + devFeeTotal)
        } else {
            //minting action so dev amt must stay the same
            devFeeBaseOut == devFeeBaseIn
        }
        
        mandatoryBankConditions &&
        validRcDelta &&
        validBankValueDelta &&
        bcReserveDelta == brDeltaExpectedWithFee &&
        validDevFeeDelta 
    }
}