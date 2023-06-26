Notes:
* After initialization 1 hodlERG should be burned so circulating supply is never zero.

{
    //Bank box
    // R4: Number of hodlERG in circulation

    //Receipt box
    // R4: Change of hodlERG in bank box
    // R5: Change of ERG in bank box
    
    val bankBoxIn = SELF
    val bankBoxOut = OUTPUTS(0)
    val receiptBox = OUTPUTS(1)
    
    val rcCircIn = bankBoxIn.R4[Long].get
    val bcReserveIn = bankBoxIn.value
    
    val rcTokensIn = bankBoxIn.tokens(0)._2
    
    val rcCircOut = bankBoxOut.R4[Long].get
    val bcReserveOut = bankBoxOut.value
    
    val rcTokensOut = bankBoxOut.tokens(0)._2
    
    val totalRcIn = rcTokensIn + rcCircIn
    val totalRcOut = rcTokensOut + rcCircOut
    
    val rcCircDelta = receiptBox.R4[Long].get
    val bcReserveDelta = receiptBox.R5[Long].get
    
    val validDeltas =   (rcCircIn + rcCircDelta == rcCircOut) &&
                        (bcReserveIn + bcReserveDelta == bcReserveOut) &&
                        rcCircOut >= 0
       
    val coinsConserved = totalRcIn == totalRcOut
    
    val tokenIdsConserved = bankBoxOut.tokens(0)._1 == bankBoxIn.tokens(0)._1 && // also ensures that at least one token exists
                            bankBoxOut.tokens(1)._1 == bankBoxIn.tokens(1)._1    // also ensures that at least one token exists
    
    val mandatoryBankConditions =   bankBoxOut.value >= 10000000L &&
                                    bankBoxOut.propositionBytes == bankBoxIn.propositionBytes &&
                                    coinsConserved &&
                                    validDeltas &&
                                    tokenIdsConserved
       
    // exchange equations
    val brDeltaExpected = { // rc
        val factor = 1000L
        val rcNominalPrice = ((bcReserveIn * factor) / rcCircIn)
        (rcNominalPrice * rcCircDelta) / factor
    }
    
    //Only fee when un-hodling
    val fee = if (brDeltaExpected < 0L) {
        (-brDeltaExpected* 3L) / 100L
    } else 0L

    val brDeltaExpectedWithFee = brDeltaExpected + fee

     //dev fee of 0.3% only on withdrawal
    val validDevFeeOutput = if (brDeltaExpected < 0L) {
        val devFeeSingle = max(((-brDeltaExpectedWithFee * 3L) / 1000L) / 3L, 1000000L)//divide fee by 3, minimum output box of 0.001 ERG

        //split devfee over 3 boxes
        val devFeeBox1 = OUTPUTS(2)
        val devFeeBox2 = OUTPUTS(3)
        val devFeeBox3 = OUTPUTS(4)
        
        //ToDo: On mainnet put in our own address!!
        //devFeeBox1.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
        devFeeBox1.value == devFeeSingle &&
        //devFeeBox2.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
        devFeeBox2.value == devFeeSingle &&
        //devFeeBox3.propositionBytes == PK("xxxxxxxxxxxx").propBytes &&  
        devFeeBox3.value == devFeeSingle
    } else true
    
    mandatoryBankConditions &&
    bcReserveDelta == brDeltaExpectedWithFee &&
    validDevFeeOutput 
}