var fs = require('graceful-fs'),
    //    sqlite3 = require('sqlite3'), look at tumblr for sqlite stuff
    // npm install -save someNPMthingee
    hbs = require('handlebars'),
    request = require('request');

function Reader(parameters){
    this.currentStockData=new Array();    
    this.historicalStockData=new Array();
    this.comparisonStockData=new Array();
    this.uniqueSymbolAndDatesArray=new Array();
    this.outputDB=parameters['databaseName'] || 'temp.sqlite3';
    this.inputPortfolioFile=parameters['portfolioFile'] || 'portfolio.json';

    this.portfolio="";
    this.completionCounter = 0;
    this.completionsNeeded = 0;
    this.stockList= new Array();

    this.purchaseDateList = new Array();

    this.historicalDataFile = 'historicalStockData.txt';

};

Reader.prototype.callbackStack = function() {
    this.AppendCurrentStockData();
//this.AppendHistoricalStockData();
    this.CalculateGains(); 
    this.PortfolioCalculateGains();
    //    console.log("cSD_cbs 1:",this.currentStockData);
    this.ComputeAnnualizedReturn(); // this.currentStockData is getting jacked up somehow in here
    //  console.log("cSD_cbs 2:",this.currentStockData);
    this.TotalPortfolioGains();
    this.TotalPortfolioPurchasePrice();
    //    console.log("output:",this.portfolio);
    //    console.log(JSON.stringify(this.portfolio));
    this.AppendCurrentStockData();
    this.CalculatePortfolioPercentages();

    var tickerNum = 2;
    switch(tickerNum) {
    case 0:
	this.CalculateComparisonResults("%5edji"); //"^dji -> %5edji 
	break;
    case 1:
	this.CalculateComparisonResults("%5egscp");
	break;
    case 2:
	this.CalculateComparisonResults("%5eixic");
	break;

    }
//  this.OutputDisplayedPortfolios(); //for json output

    //I still need to run the TotalPortfolioGains and TotalPortfolioPurchasePrice functions
    //or have a switch to only operate on those portfolios which are displayed. Then we could output again only those that are
    //Or have the first operation be to only return the display = yes portfolios

    this.RenderOutput(); //for html output
//    this.ParseForPieChart("shares","ticker");
//    this.ParseForPieChart("totalPurchasePrice","ticker"); //is there an easier way such that I could do a watch on the datasource and refresh the graph? That way I don't have to have multiple graphs that are displayed  or hidden based on what data is selected.
};

Reader.prototype.CheckComplete = function() {
    this.completionCounter+=1;
//    console.log("cC:"+this.completionCounter);
    if (this.completionCounter==this.completionsNeeded){
	//	console.log("calling cbS");
	this.callbackStack();
    }

};
Reader.prototype.Package1 = function () {
  this.CreateListOfUniqueStockSymbolsAndDates();
  this.GetHistoricalStockData(this.CheckComplete.bind(this));
};
Reader.prototype.init = function() {
//    this.ReadHistoricalStockData(this.CreateListOfUniqueStockSymbolsAndDates.bind(this));
    this.ReadHistoricalStockData(this.Package1.bind(this));
    this.completionsNeeded = 2;
    this.portfolio = JSON.parse(fs.readFileSync(this.inputPortfolioFile, 'utf8'));
    this.CreateListOfUniqueStockSymbols();
    this.CreateListOfUniquePurchaseDates();
//    this.CreateListOfUniqueStockSymbolsAndDates();
    this.CalculatePurchaseSharePrice();
    this.CalculateHoldingTimePeriod();

    //Asynch call
    this.GetCurrentStockData(this.CheckComplete.bind(this));
    //Asynch call
    this.GetHistoricalStockData(this.CheckComplete.bind(this));
  
    /*    
  var that = this;
    // this.CalculatePurchaseSharePrice();
    console.log("this.portfolio");
    console.log(JSON.stringify(this.portfolio));
    console.log("this.stockList");
    console.log(JSON.stringify(this.stockList.sort()));
    console.log("this.purchaseDateList");
    console.log(JSON.stringify(this.purchaseDateList.sort()));

    console.log("this.uniqueSymbolAndDatesArray");
    console.log(JSON.stringify(this.uniqueSymbolAndDatesArray));
    */
};

Reader.prototype.PrintUniqueTickers = function() {
    for (var i = 0; i<this.stockList.length; i++){
	console.log(this.stockList[i]);
    }
};

Reader.prototype.CreateListOfUniqueStockSymbols = function() {

//add in default indices, proly should add in wilsire and other large ones.
    this.stockList.push("^dji");
    this.stockList.push("^gspc");
    this.stockList.push("^ixic");
    
    /*this.portfolio.portfolio.forEach( function(ele,idx,fA) {
      ele.portfolioStocks.forEach( function(ele_,idx_,fA_){
      this.stockList.forEach( function(ele__,idx__,fA__) {
      doing it this way with forEach just seems so cumbersome with all the closures and variables and bs		
      });
      };
      });*/
    for ( var i=0;i<this.portfolio.portfolio.length;i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for ( var j=0;j<this.portfolio.portfolio[i].portfolioStocks.length;j++){
		var foundFlag=false;
		for ( var k=0;k<this.stockList.length;k++){
		    if (this.stockList[k]===this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase()){
			foundFlag=true;
			break;
		    }
		}
		if (foundFlag===false){
                    this.stockList.push(this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase() );
		}
	    }
	}
    }
}

//This is needed to efficiently perform the comparison to the benchmark  --> this would need to be reworked if each stock or each portfolio could have its own comparator/benchmark
Reader.prototype.CreateListOfUniquePurchaseDates = function() {
    for ( var i=0;i<this.portfolio.portfolio.length;i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for ( var j=0;j<this.portfolio.portfolio[i].portfolioStocks.length;j++){
		var foundFlag=false;
		for ( var k=0;k<this.purchaseDateList.length;k++){
		    if (this.purchaseDateList[k]===this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate ){
			foundFlag=true;
			break;
		    }
		}
		if (foundFlag===false){
		    
                    this.purchaseDateList.push(this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate);
		}
	    }
	}
    }
}


//why stick the data in a sqlitedb when the db would be temp anyway. just save the data off in a flatafile/json object
Reader.prototype.GetCurrentStockData = function(cb) {
//  console.log("GetCurrentStockData");
    var that = this;
    var completionCounter=0;
    
    var today = new Date()
    var day=today.getDate(); //day of month
    var weekday=today.getDay();

    //this is a weak fix to prevent trying to look things up on weekends.  How did I do this for the python version?
    switch(weekday) {
    case 0:
	day-=2;
	break;
	
    case 6:
	day-=1;
	break;
    }
    var month=today.getMonth()+1; 
    var year=today.getFullYear();
    var myDateString=year+"-"+month+"-"+day;
    //    console.log("stockList.length:"+this.stockList.length);
    for (var i = 0; i< this.stockList.length; i++){
	var requestOptions= {
	    url:'http://download.finance.yahoo.com/d/quotes.csv?s=' + this.stockList[i] + '&f=l1opwt7',
	    headers: {'User-Agent' : 'Mozilla/5.0 (X11; U; Linux i686) Gecko/20071127 Firefox/2.0.0.11' }
	}
	var dataRequest=request(requestOptions,(function(i,url) { return function(err,resp,body) {
            if (err){
		if (err.code === 'ECONNREFUSED') {
		    console.error(url+' Refused connection');
		} else if (err.code==='ECONNRESET') {
		    console.error(url+' reset connection')
		} else if (err.code==='ENOTFOUND') {
		    console.error(url+' enotfound')
		} else {
		    console.log(url+" "+err);
		    console.log(err.stack);
		}
	    }
	    //	    console.log(resp);
	    //	    	    console.log(url);
	    //	    console.log(i);
	    
	    //	    console.log(that.stockList[i]+" " +body);
	    var split = body.replace(/\"/g,"").replace(/\n/,"").split(",");
	    
	    var lowHigh=split[3].split(" - "),
		low=lowHigh[0] || "",
		high=lowHigh[1] || "";
	    that.currentStockData.push({ticker:that.stockList[i],
					currentPrice:parseFloat(split[0]),
					openPrice:parseFloat(split[1])||null,
					prevClosePrice:parseFloat(split[2])||null,
					fiftyTwoWeekLow:parseFloat(low)||null,
				       fiftyTwoWeekHigh:parseFloat(high)||null,
					trend:split[4],
					date:myDateString
				       });
	    //	    console.log(JSON.stringify(that.currentStockData[that.currentStockData.length-1]));
	    completionCounter++;
            //console.log("cC:"+completionCounter+" t.sL.l:"+that.stockList.length);
	    //ensure that all requests complete before executing callback
	    if (completionCounter==that.stockList.length){
		//		console.log(JSON.stringify(that.currentStockData));
		//		console.log("getCurrentStockData done");
		//console.log("cSD:",that.currentStockData);
		if (cb && typeof cb === 'function') {
		    cb();
		}
	    }
        }
								})(i,requestOptions.url)
			       );

    }
    //  console.log(JSON.stringify(outputArray));
    
}

//Reader.prototype.CalculateDollarGains = function(){
Reader.prototype.CalculateGains = function(){
    //  console.log("0 cSD_cG:",this.currentStockData);
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
		var currentStockTicker = this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase();
		//		console.log("cSD_cG:",this.currentStockData);
		var stockData = this.currentStockData.filter( function(item) {
                    return item.ticker === currentStockTicker.toLowerCase(); // 'this' context changes so I created currentStockTicker
                });
		if ( stockData.length == 0 ){ console.log("shitCG:"+currentStockTicker);} else {
		    //console.log(stockData[0].currentPrice);
		    this.portfolio.portfolio[i].portfolioStocks[j].dollarGain =  stockData[0].currentPrice * (this.portfolio.portfolio[i].portfolioStocks[j].shares) - (this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice) ;

//should i be taking out the commission price for this percent gain calculation?  nah.. it gives us a true value of gains since the totalPurchasePrice has the commission in it. might even want to take out the commission to sell...but then why not take into acct taxes etc etc etc...waht a rabbit hole. 
		    var temp = (this.portfolio.portfolio[i].portfolioStocks[j].dollarGain / this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice ) * 100;
		    this.portfolio.portfolio[i].portfolioStocks[j].percentGain = temp == null ? Infinity : temp;
		    this.portfolio.portfolio[i].portfolioStocks[j].currentValue = stockData[0].currentPrice * this.portfolio.portfolio[i].portfolioStocks[j].shares;
		    if (this.portfolio.portfolio[i].portfolioStocks[j].expenseRatio){
			this.CalculateMutualFundFeesPaid(this.portfolio.portfolio[i].portfolioStocks[j],stockData[0]);
///			console.log("j",this.portfolio.portfolio[i].portfolioStocks[j].mutualFundFeesPaid)
		    }
		    

		}
	    }
	}
    }
    //console.log(JSON.stringify(this.portfolio));
}

Reader.prototype.CalculateMutualFundFeesPaid = function(portfolioStock,stockData) {
    //this is a really hard thing to keep track of because the ER changes over time as well as the value of the underlying share.
    portfolioStock.mutualFundFeesPaid = portfolioStock.holdingTimePeriodInYears * portfolioStock.expenseRatio * portfolioStock.shares * stockData.currentPrice / 100 ; //this calculation can present a worst case number if the security is at a high with the ER being high. Or if both aren't highs, then it can be less than or equal to worst case
}

Reader.prototype.TotalMutualFundFeesPaid = function() {
    var totalGains = 0 ;
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	if ( this.portfolio.portfolio[i].display == 'yes'){
	    
	    totalGains += this.portfolio.portfolio[i].portfolioGains;
	}
    }
    this.portfolio.totalGains = totalGains;
}

Reader.prototype.TotalPortfolioGains = function() {
    var totalGains = 0 ;
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	if ( this.portfolio.portfolio[i].display == 'yes'){
	    totalGains += this.portfolio.portfolio[i].portfolioGains;
	}
    }
    this.portfolio.totalGains = totalGains;
}

Reader.prototype.TotalPortfolioPurchasePrice = function() {
    var totalPurchasePrice = 0 ;
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	if ( this.portfolio.portfolio[i].display == 'yes'){
	    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
		totalPurchasePrice += this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice;
	    }
	}
    }
    this.portfolio.totalPurchasePrice = totalPurchasePrice;
}

Reader.prototype.PortfolioCalculateGains = function(){
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	var dailyGains = 0,
            dailyLosses = 0,
totalDailyGains = 0,
totalDailyLosses = 0, 
	totalCommissionPaid = 0,
	totalPurchasePrice = 0,
	totalGainLoss = 0,
        totalGains = 0,
	    totalLosses = 0,
	    portfolioMutualFundFeesPaid = 0, 
	portfolioValue = 0;
	if ( this.portfolio.portfolio[i].display == 'yes'){
	    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
		if ( this.portfolio.portfolio[i].portfolioStocks[j].dollarGain > 0) {
		    totalGains+=this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;
		} else {
		    totalLosses += this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;
		}

		if ( this.portfolio.portfolio[i].portfolioStocks[j].dailyGainLoss > 0) {
		    totalDailyGains+=this.portfolio.portfolio[i].portfolioStocks[j].dailyGainLoss;
		} else {
		    totalDailyLosses += this.portfolio.portfolio[i].portfolioStocks[j].dailyGainLoss;
		}

		totalGainLoss += this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;
		totalCommissionPaid += this.portfolio.portfolio[i].portfolioStocks[j].commissionToBuy;
		totalPurchasePrice += this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice;
		portfolioValue += this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice + this.portfolio.portfolio[i].portfolioStocks[j].dollarGain - this.portfolio.portfolio[i].portfolioStocks[j].commissionToBuy ;
		if (typeof this.portfolio.portfolio[i].portfolioStocks[j].mutualFundFeesPaid === "number" ) {
		    portfolioMutualFundFeesPaid += this.portfolio.portfolio[i].portfolioStocks[j].mutualFundFeesPaid;
		}
	    }
	    this.portfolio.portfolio[i].totalDailyGains = totalDailyGains;
	    this.portfolio.portfolio[i].totalDailyLosses = totalDailyLosses;

	    this.portfolio.portfolio[i].totalGains = totalGains;
	    this.portfolio.portfolio[i].totalLosses = totalLosses;
	    this.portfolio.portfolio[i].totalGainLoss = totalGainLoss;
	    this.portfolio.portfolio[i].totalCommissionPaid = totalCommissionPaid;
	    this.portfolio.portfolio[i].totalPurchasePrice = totalPurchasePrice;
	    this.portfolio.portfolio[i].totalMutualFundFeesPaid = portfolioMutualFundFeesPaid;
	    this.portfolio.portfolio[i].portfolioValue = portfolioValue;	    
	}
    }
}

Reader.prototype.CalculateHoldingTimePeriod = function() {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
    
    var now = new Date;
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
		var pD = new Date(this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate); // "10/23/2003" 
		this.portfolio.portfolio[i].portfolioStocks[j].holdingTimePeriodInYears = ( now - pD ) / ( 365 * 24 * 3600 * 1000);
	    }
	}
    }
}

//if a piece of the puzzle is missing have it call the missing piece with itself as a callback so that it gets run upon completion of the missing piece.
Reader.prototype.CalculateAnnualizedReturn = function(stockItem) {
    var annualizedReturn = 0;
    //console.log(stockItem);
    //I believe that I should take into account the commissionToSell in the calculation (and taxes) to truly calculate annualized return)

    //  console.log("cSD.l:"+this.currentStockData.length);
    //use filter to find matching stock https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
    var currentSharePriceArray = this.currentStockData.filter( function(value){
	return value.ticker === stockItem.ticker.toLowerCase();
    });
    if (currentSharePriceArray.length > 0){
	//	console.log("cSPA[0]:"+currentSharePriceArray[0])
	var endingValue = stockItem.shares * (currentSharePriceArray[0].currentPrice) /* - stockItem.commissionToSell */;

	//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/pow
	//    var annualizedReturn = Math.pow( ( endingValue - stockItem.totalPurchasePrice ) / stockItem.totalPurchasePrice + 1 , 1/this.CalculateHoldingTimePeriod(stockItem) )*100;
	//  console.log(endingValue + " "+ stockItem.totalPurchasePrice+1 +" "+ stockItem.totalPurchasePrice + 1 + " " +stockItem.holdingTimePeriodInYears );
	annualizedReturn = (Math.pow( ( endingValue - (stockItem.totalPurchasePrice) ) / (stockItem.totalPurchasePrice) + 1 , 1/stockItem.holdingTimePeriodInYears ) -1)*100;
    }
    return annualizedReturn;
};

Reader.prototype.ComputeAnnualizedReturn = function(){
    //    console.log("cSD_cAR 1:",this.currentStockData);
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
		this.portfolio.portfolio[i].portfolioStocks[j].annualizedReturn = this.CalculateAnnualizedReturn( this.portfolio.portfolio[i].portfolioStocks[j] );
		//	    	console.log("aR",this.portfolio.portfolio[i].portfolioStocks[j].annualizedReturn);
	    }
	}
    }
    //    console.log("cSD_cAR 2:",this.currentStockData);
};

Reader.prototype.CalculatePurchaseSharePrice = function(){
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
		if (typeof this.portfolio.portfolio[i].portfolioStocks[j].sharePrice !== 'undefined') {
		    this.portfolio.portfolio[i].portfolioStocks[j].sharePrice = ( parseFloat(this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice) - parseFloat(this.portfolio.portfolio[i].portfolioStocks[j].commissionToBuy) ) / parseFloat(this.portfolio.portfolio[i].portfolioStocks[j].shares);
		    //		console.log("sharePrice",this.portfolio.portfolio[i].portfolioStocks[j].sharePrice);
		}
	    }
	}
    }
}

Reader.prototype.CalculateComparisonResults = function(ticker) {
//Reader.prototype.AppendHistoricalStockData = function() {
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
		var comparisonCurrentStockData = this.currentStockData.filter( function(item) {
                    return item.ticker === ticker.toLowerCase(); 
                });
var stock = this.portfolio.portfolio[i].portfolioStocks[j]; 
		var comparisonHistoricalStockData = this.historicalStockData.filter( function(item) {
//this is failing. derp, I didn't/don't have the historical data for the comparison stock. damn this comparator stock can double (in worst case) the amount of network calls for historical data. Good idea to save this off. Then only need to get current data. 
		    var parsedItemDate = item.date.split("-"),
//month is 0 based
		    histDate = new Date(parseInt(parsedItemDate[0]),parseInt(parsedItemDate[1])-1,parseInt(parsedItemDate[2])), //item.date),
		    currentDate = new Date(stock.purchaseDate);
//		    console.log(" id:"+item.date + " s.pd:"+stock.purchaseDate + " hD:" + histDate + " cD:" + currentDate + " parsedItemDate:"+parsedItemDate);
//		    console.log("i.t:"+item.ticker+ " t.tLC():"+ticker.toLowerCase());
                    return item.ticker === ticker.toLowerCase() && histDate === currentDate;
                });


//		console.log("hsd",this.historicalStockData);
		if (comparisonCurrentStockData.length && comparisonHistoricalStockData.length ) {		
//		this.portfolio.portfolio[i].portfolioStocks[j].comparisonAnnualizedReturn = comparisonCurrentStockData[0].currentPrice - comparisonHistoricalStockData[0].adjClose / ;
		//this.portfolio.portfolio[i].portfolioStocks[j].shares * 
//		    console.log("cHSD0.adjClose:"+(comparisonHistoricalStockData[0].adjClose+00) + " comparisonCurrentStockData[0].currenPrice:"+(comparisonCurrentStockData[0].currentPrice+00) +  " this.portfolio.portfolio[i].portfolioStocks[j].holdingTimePeriodInYears:"+ (this.portfolio.portfolio[i].portfolioStocks[j].holdingTimePeriodInYears+00));
	/*	    console.log(typeof comparisonHistoricalStockData[0].adjClose);
		    console.log(typeof comparisonCurrentStockData[0].currentPrice);
		    console.log(typeof this.portfolio.portfolio[i].portfolioStocks[j].holdingTimePeriodInYears);*/


		    annualizedReturn = (Math.pow( (  comparisonCurrentStockData[0].currentPrice - comparisonHistoricalStockData[0].adjClose  )  / comparisonHistoricalStockData[0].adjClose +1 , 1/this.portfolio.portfolio[i].portfolioStocks[j].holdingTimePeriodInYears ) -1)*100;
//		console.log(annualizedReturn);
		} else {
/* not sure what this was for
		    if (comparisonCurrentStockData.length === 0 ) {
			console.log("cCSD.l = 0");
		    } else {
			console.log("cHSD.l = 0");
		    }
*/
		}
	    }
	}
    }
}

//the uniqueSymbolAndDatesArray is used to retrieve the historical stock data with as few network calls as possible.
Reader.prototype.CreateListOfUniqueStockSymbolsAndDates = function() {
//console.log("yeopp");
  var comparisonTicker = "";
    //loop over the portfolio
    for ( var i=0;i<this.portfolio.portfolio.length;i++){
	if (this.portfolio.portfolio[i].display=="yes"){
          if (this.portfolio.portfolio[i].comparisonTicker) {
            comparisonTicker = this.portfolio.portfolio[i].comparisonTicker;
          }
	    for ( var j=0;j<this.portfolio.portfolio[i].portfolioStocks.length;j++){
		var foundTickerFlag=false,
                    foundComparisonTickerFlag=false;
		for ( var k=0; k < this.uniqueSymbolAndDatesArray.length; k++ ){
                  if (this.portfolio.portfolio[i].portfolioStocks[j].comparisonTicker) {
                    comparisonTicker = this.portfolio.portfolio[i].portfolioStocks[j].comparisonTicker;
}
		    if ( this.uniqueSymbolAndDatesArray[k].ticker===this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase() &&
			 this.uniqueSymbolAndDatesArray[k].date===this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate ){
//console.log("t.uSADA.t:"+this.uniqueSymbolAndDatesArray[k].ticker+" ct:"+comparisonTicker+" t.p.p.pS.pD:"+this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate );
			foundTickerFlag=true;
                      if (foundComparisonTickerFlag === true) {
			break; //only break with both flags are true.
                      }
		    }

		    if ( 
//			  ( this.portfolio.portfolio[i].portfolioStocks[j].comparisonTicker && this.uniqueSymbolAndDatesArray[k].ticker === this.portfolio.portfolio[i].portfolioStocks[j].comparisonTicker.toLowerCase()) ) &&
			  this.uniqueSymbolAndDatesArray[k].ticker === comparisonTicker.toLowerCase()  &&
			 this.uniqueSymbolAndDatesArray[k].date===this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate ){
//console.log("t.uSADA.t:"+this.uniqueSymbolAndDatesArray[k].ticker+" ct:"+comparisonTicker+" t.p.p.pS.pD:"+this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate );
			foundComparisonTickerFlag=true;
                      if (foundTickerFlag === true) {
			break;
                      }
		    }
		}

		//add data if matching data not found
		if (foundTickerFlag===false){
		    this.uniqueSymbolAndDatesArray.push({
			ticker:this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase(),
			date:this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate
		    });
		}
		if (foundComparisonTickerFlag===false){
		    this.uniqueSymbolAndDatesArray.push({
			ticker:comparisonTicker,
			date:this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate
		    });
		}

	    }
	}
    }
    //loop over the already retrieved historical data
    for ( i=0;i<this.historicalStockData.length;i++){
	foundFlag=false;
	for ( var k=0; k < this.uniqueSymbolAndDatesArray.length; k++ ){
	    if ( this.uniqueSymbolAndDatesArray[k].ticker===this.historicalStockData[i].ticker.toLowerCase() &&
		  this.uniqueSymbolAndDatesArray[k].date===this.historicalStockData[i].date ){
		foundFlag=true;
		break;
	    }
	}
	//add data if matching data not found
	if (foundFlag===false){  //is this conditional statement redundant because of the break?
	    this.uniqueSymbolAndDatesArray.push({
		ticker:this.historicalStockData[i].ticker.toLowerCase(),
		date:this.historicalStockData[i].date
	    });
	}
    }
//  console.log("t.uSADA:",this.uniqueSymbolAndDatesArray);
};

//can we generalize this function to pass in the array to be written/pushed to, the propert(ies) to compare, and the propert(ies) to write?
Reader.prototype.CreateListOfComparisonStocks = function() {
    for ( var i=0;i<this.portfolio.portfolio.length;i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for ( var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++ ){
		var foundFlag=false;
		for ( var k=0; k<this.comparisonStockData.length; k++ ){
		    if ( this.comparisonStockData[k].ticker===this.portfolio.portfolio[i].portfolioStocks[j].compareToTicker.toLowerCase() &&
			 this.comparisonStockData[k].date  ===this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate ){
			foundFlag=true;
			break;
		    }
		}
		//add data if matching data not found
		if (foundFlag===false){
		    this.comparisonStockData.push({
			ticker:this.portfolio.portfolio[i].portfolioStocks[j].compareToTicker.toLowerCase(),
			date:this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate
		    });
		}
	    }
	}
    }

//add the unique stocks to this.stockList so that we get the current stock data
//it might be simplest to keep the comparison stocks for different dates as separate entries instead of a single stock ticker but an array of dates. 
};

//This is only used for our comparison to a standard/benchmark. If we only want to analyze raw returns, we only need the data from the last close bc we have the datapoint for when  the security was purchased.
Reader.prototype.GetHistoricalStockData = function(cb) {
//  console.log("GetHistoricalStockData");
    var that = this,
	completionCounter = 0;
  //  console.log(this.uniqueSymbolAndDatesArray.length);
    for (var i = 0; i < this.uniqueSymbolAndDatesArray.length; i++){
//		console.log(this.uniqueSymbolAndDatesArray[i]);
	var date = this.uniqueSymbolAndDatesArray[i].date.split("/");
	var month = parseFloat(date[0])-1;
	var day = parseFloat(date[1]);
	var dayMinusOne = day -1;
	//https://code.google.com/p/yahoo-finance-managed/wiki/csvHistQuotesDownload formatting doc. 
	var url = "http://ichart.yahoo.com/table.csv?s=" + this.uniqueSymbolAndDatesArray[i].ticker +
	    "&a="+ month + 
	    "&b="+ day + 
	    "&c="+ date[2] +
	    "&d="+ month + 
	    "&e="+ day + 
	    "&f="+ date[2] +
	    "&g=&ignore=.csv"
	//	console.log(date +"myUrl",url);
	var requestOptions= {
	    url:url,
	    headers: {'User-Agent' : 'Mozilla/5.0 (X11; U; Linux i686) Gecko/20071127 Firefox/2.0.0.11' }
	}
	//	console.log(this.uniqueSymbolAndDatesArray[i].ticker +"-"+ this.uniqueSymbolAndDatesArray[i].ticker.toLowerCase );
	if (this.uniqueSymbolAndDatesArray[i].ticker.toLowerCase() !== 'prrxx') {
	    var dataRequest=request(requestOptions,(function(i,url) { return function(err,resp,body) {
		if (err){
		    if (err.code === 'ECONNREFUSED') {
			console.error(url+' Refused connection');
		    } else if (err.code==='ECONNRESET') {
			console.error(url+' reset connection')
		    } else if (err.code==='ENOTFOUND') {
			console.error(url+' enotfound')
		    } else {
			console.log(url+" "+err);
			console.log(err.stack);
		    }
		    //			 that.saveFile(filename,url);//call ourself again if there was an error (mostlikely due to hitting the server too hard)
		    //use settimeout and call yourself?
		}
		//The data is csv with the first line being the column headers of :
		//Date,Open,High,Low,Close,Volume,Adj Close
		var data = body.split("\n");
//		console.log(url + " : " +that.uniqueSymbolAndDatesArray[i].ticker+" "+that.uniqueSymbolAndDatesArray[i].date+"=-> " +body/*data[1]*/);
		var stockData = data[1].split(",");
		
		that.historicalStockData.push({ticker:that.uniqueSymbolAndDatesArray[i].ticker,
					       date:stockData[0],
					       openPrice:parseFloat(stockData[1]),
					       highPrice:parseFloat(stockData[2]),
					       lowPrice:parseFloat(stockData[3]),
					       closePrice:parseFloat(stockData[4]),
					       volume:parseFloat(stockData[5]),
					       adjClose:parseFloat(stockData[6])  // <-- adjClose is the split adjusted price
					      });
		//		console.log(JSON.stringify(that.currentStockData[that.currentStockData.length-1]));
		completionCounter++;
//				console.log(completionCounter+" "+that.uniqueSymbolAndDatesArray.length);
		//ensure that all requests complete before executing callback
		if (completionCounter==that.uniqueSymbolAndDatesArray.length){
		  //console.log(JSON.stringify(that.currentStockData));
		    //		    console.log("getHistoricalStockData done");
		    //		    console.log(JSON.stringify(that.historicalStockData));
		    that.WriteHistoricalStockData();
		    if (cb && typeof cb==='function') {
			cb();
		    }
		}
            }
								    })(i,requestOptions.url)
				   );
	} else {
	    //if prrxx still need to increment completioncounter
	    completionCounter++
	}

    }
    
};



Reader.prototype.OutputDisplayedPortfolios = function() {
    var outputPortfolioArray = {portfolio:[]};//new Array
    outputPortfolioArray.portfolio = this.portfolio.portfolio.filter( function(insidePortfolio) {
        return insidePortfolio.display == "yes";
    });

    console.log("l---:",outputPortfolioArray);

    for (var i =0; i<outputPortfolioArray.portfolio.length;i++){
	for (var j =0; j<outputPortfolioArray.portfolio[i].portfolioStocks.length;j++){
//	    console.log(outputPortfolioArray.portfolio[i].portfolioStocks[j]);
	}
    }
}


Reader.prototype.RenderOutput = function() {
//console.log("render");
    var stockTemplate = "<div><span class=\"\">{{ticker}}</span>"
        + "<span class=\"\">{{shares}}</span>"
        + "<span class=\"\">{{totalPurchasePrice}}</span> "
        + "<span class=\"\">{{purchaseDate}}</span>"
        + "<span class=\"\">{{commissionToBuy}}</span>"
        + "<span class=\"\">{{commissionToSell}}</span>"
        + "<span class=\"\">{{holdingTimePeriodInYears}}</span>"
        + "<span class=\"{{colorStyling }}\">{{dollarGain}}</span>"
        + "<span class=\"{{colorStyling }}\">{{percentGain}}</span> "
        + "<span class=\"{{colorStyling }}\">{{annualizedReturn}}</span> "
        + "<span class=\"\">{{currentPrice}}</span>  "
        + "<span class=\"\">{{openPrice}}</span>  "
        + "<span class=\"\">{{prevClosePrice}}</span>  "
        + "<span class=\"\">{{fiftyTwoWeekLow}}</span>  "
        + "<span class=\"\">{{fiftyTwoWeekHigh}}</span>  "
        + "<span class=\"\">{{trend}}</span>  </div>\n",
	stockTemplateTable = "<tr><td class=\"ticker\"><a href=\"http://finance.yahoo.com/echarts?s={{ticker}}+Interactive#symbol={{ticker}};range=1y\">{{ticker}}</a></td>"
	+ "<td class=\"currency\">{{shares}}</td>"
	+ "<td class=\"number \">${{formatCurrency totalPurchasePrice}}</td> "
	+ "<td class=\"number {{ colorStylingPositive dollarGain}}\">${{formatCurrency dollarGain}}</td>"
    	+ "<td class=\"number \">${{formatCurrency currentValue}}</td> "
	+ "<td class=\"\">{{purchaseDate}}</td>"
	+ "<td class=\"number \">${{formatCurrency commissionToBuy}}</td>"
	+ "<td class=\"number \">${{formatCurrency commissionToSell}}</td>"
	+ "<td class=\"number \">{{formatNumber_TwoDecimal holdingTimePeriodInYears}}</td>"
	+ "<td class=\"number {{colorStylingPositive dailyGainLoss}}\">${{formatCurrency dailyGainLoss}}</td>"
	+ "<td class=\"number {{colorStylingPositive percentGain}}\">{{formatNumber_TwoDecimal percentGain}}%</td> "
	+ "<td class=\"number {{colorStylingPositive annualizedReturn}}\">{{formatNumber_TwoDecimal annualizedReturn}}%</td> "
	+ "<td class=\"number \">${{formatCurrency currentPrice}}</td>  "
	+ "<td class=\"number \">${{formatCurrency openPrice}}</td>  "
	+ "<td class=\"number \">${{formatCurrency prevClosePrice}}</td>  "
	+ "<td class=\"number \">{{formatNumber_TwoDecimal percentageOfPortfolio}}%</td>  "
	+ "<td class=\"number \">${{formatCurrency fiftyTwoWeekLow}}</td>  "
	+ "<td class=\"number \">${{formatCurrency fiftyTwoWeekHigh}}</td>  "
	+ "<td class=\"number \">{{formatNumber_TwoDecimal fiftyTwoWeekPercentage}}%</td>  "
	+ "<td class=\"number \">{{formatNumber_TwoDecimal fiftyTwoWeekSpread}}%</td>  "
    	+ "<td class=\"number \">${{formatCurrency mutualFundFeesPaid}}</td>  "
	+ "<td class=\"\">{{trend}}</td> </tr>\n",
	
	portfolioTemplate = "<div>{{portfolioName}}</div>"
        + " <div>{{date}}</div><div>{{portfolioGains}}</div>"+
	"<ul>{{#portfolioStocks}}<li>{{ticker}} is {{currentPrice}}</li>{{/portfolioStocks}}</ul>",

	template,

        portfolioStatsTemplate = "<tr><td colspan=\"4\">Portfolio Worth</td><td colspan=\"4\">${{ formatCurrency portfolioValue}}</td><td colspan=\"12\"></td></tr>"
                                 + "<tr><td colspan=\"4\">Gains </td><td colspan=\"4\">${{ formatCurrency totalGains}}</td><td colspan=\"12\"></td></tr>"
                                 + "<tr><td colspan=\"4\">Losses </td><td colspan=\"4\">${{ formatCurrency totalLosses}}</td><td colspan=\"12\"></td></tr>"
                                 + "<tr><td colspan=\"4\">Total Gains </td><td colspan=\"4\">${{ formatCurrency totalGainLoss}}</td><td colspan=\"12\"></td></tr>"
                                 + "<tr><td colspan=\"4\">Commission Paid </td><td colspan=\"4\">${{ formatCurrency totalCommissionPaid}}</td><td colspan=\"12\"></td></tr>"
                                 + "<tr><td colspan=\"4\">Total Purchase Price </td><td colspan=\"4\">${{ formatCurrency totalPurchasePrice}}</td><td colspan=\"12\"></td></tr>"
        + "<tr><td colspan=\"4\">Daily Gains</td><td colspan=\"4\">${{ formatCurrency totalDailyGains}}</td><td colspan=\"12\"></td></tr>"
    
        + "<tr><td colspan=\"4\">Daily Losses </td><td colspan=\"4\">${{ formatCurrency totalDailyLosses}}</td><td colspan=\"12\"></td></tr>"
        + "<tr><td colspan=\"4\">Mutual Fund Fees Paid </td><td colspan=\"4\">${{ formatCurrency totalMutualFundFeesPaid}}</td><td colspan=\"12\"></td></tr>"
                                 + "<tr><td colspan=\"4\">PortfolioWorth </td><td colspan=\"4\">${{ formatCurrency portfolioValue}}</td><td colspan=\"12\"></td></tr>",

	mySwitch = 2;

    hbs.registerHelper("colorStylingPositive", function(value) {
	//	console.log((parseFloat(value) > 0)+ " "+ value);
	return parseFloat(value) > 0 ? "positive" : "negative";
    });

    hbs.registerHelper("colorStylingPercent", function(value) {
	return value > 1 ? "positive":"negative";
    });
    hbs.registerHelper("formatCurrency",function(value){
	if (value == null || value == '' || value == 'N/A' ) {
	    return value  
	}
	return numberWithCommas(value.toFixed(2));
    });
    hbs.registerHelper("formatNumber_TwoDecimal",function(value){
	if (value == null || value == '' || value == 'N/A') {
	    return null
	}
	return value.toFixed(2);
    });
    var rightNow = new Date();
    console.log("<!DOCTYPE html>"
		+ "<html>"
		+ "<head><title>"
		+  rightNow
		+ "</title> \n"
		+ '<meta HTTP-EQUIV="Refresh" CONTENT="450" charset="utf-8" />'
		+ '<script type="text/javascript" src="jquery-2.1.4.min.js"></script>'
		+ '<script type="text/javascript" src="jquery.tablesorter.js"></script>'
		+ '<script type="text/javascript">'
		+ '$(document).ready(function(){'
		+ '$("table").tablesorter({});' //sortList: [[0,0],[4,0],[15,0]]});' //this sortList isn't working for me for some reaosn
		+ '});'
		+ "</script>"
		+ "<style type=\"text/css\"> \n"
		+ ".ticker    { text-transform: uppercase } \n"
		+ ".ticker a  { text-decoration: none; } \n"
		+ ".positive  { background-color:green } \n"
		+ ".negative  { background-color:red } \n"
		+ ".number    { text-align:right } \n"
		+ "tr:hover   { background-color: #b8d1f3 } \n"
		+ ".portfolio { border-bottom:1px solid black } \n"
		+ "</style> \n"
		+ "</head><body>");

    switch(mySwitch) {
    case 0:
	template = hbs.compile(stockTemplate);
	for ( var i=0;i<this.portfolio.portfolio.length;i++){
	    if (this.portfolio.portfolio[i].display == "yes") {
		for ( var j=0;j<this.portfolio.portfolio[i].portfolioStocks.length;j++){
		    //damn I want cool color coding via styles as well. not sure HBS' expression syntax is that fully featured to test numeric values
		    console.log(template(this.portfolio.portfolio[i].portfolioStocks[j]));
		}
	    }
	}
	break;
    case 1:
	template = hbs.compile(portfolioTemplate);
	for ( var i=0;i<this.portfolio.portfolio.length;i++){
	    if (this.portfolio.portfolio[i].display == "yes") {
		console.log(template(this.portfolio.portfolio[i]));
	    }
	}
	break;
    case 2:
	template = hbs.compile(stockTemplateTable);
	for ( var i=0;i<this.portfolio.portfolio.length;i++){
	    if (this.portfolio.portfolio[i].display == "yes") {
		console.log("<h3>"+this.portfolio.portfolio[i].portfolioName+"</h3>");
		console.log("<div class=\"portfolio\"><table><thead>");
		console.log("<tr><th class=\"\">ticker</th>"
			    + "<th class=\"\">shares</th>"
			    + "<th class=\"\">Purchase Price</th> "
			    + "<th class=\"colorStylingPositive dollarGain\">Gain</th>"
			    + "<th class=\"\">Curr Value</th> "
			    + "<th class=\"\">Purchase Date</th>"
			    + "<th class=\"\">Buy</th>"
			    + "<th class=\"\">Sell</th>"
			    + "<th class=\"\">Years Held</th>"
			    + "<th class=\"\">Daily +/-</th>"
			    + "<th class=\"colorStylingPercent percentGain\">pct Gain</th> "
			    + "<th class=\"colorStylingPositive annualizedReturn\">ann Return</th> "
			    + "<th class=\"\">Current Price</th>  "
			    + "<th class=\"\">Open</th>  "
			    + "<th class=\"\">Prev Close</th>  "
			    + "<th class=\"\">Pct of Prtflo</th>  "
			    + "<th class=\"\">52 Low</th>  "
			    + "<th class=\"\">52 High</th>  "
			    + "<th class=\"\">52 Pct</th>  "
			    + "<th class=\"\">52 Sprd</th>  "
			    + "<th class=\"\">MF Fees</th>  "
			    + "<th class=\"\">trend</th> </tr></thead><tbody>\n");
		for ( var j=0;j<this.portfolio.portfolio[i].portfolioStocks.length;j++){
		    console.log(template(this.portfolio.portfolio[i].portfolioStocks[j]));
		}
		//separate stats table so that sort works only on the individual stock data
		console.log("</tbody></table>");
		
		console.log("<table><thead><tr><th></th><th></th></tr></thead><tbody>");	    
		var template2 = hbs.compile(portfolioStatsTemplate);
		console.log(template2(this.portfolio.portfolio[i]));
		console.log("</tbody></table></div>");
	    }
	}

	break;
    }

    //console.log(result);
    console.log("</body></html>");
}

Reader.prototype.AppendCurrentStockData = function() {
    for ( var i=0;i<this.portfolio.portfolio.length;i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for ( var j=0;j<this.portfolio.portfolio[i].portfolioStocks.length;j++){
                var currentStockTicker = this.portfolio.portfolio[i].portfolioStocks[j].ticker;
		var stockData = this.currentStockData.filter( function(item) {
		    return item.ticker === currentStockTicker.toLowerCase(); // 'this' context changes so I created currentStockTicker
                });
		if ( stockData.length == 0 ){ console.log("shitACSD:"+currentStockTicker);} else {
		    this.portfolio.portfolio[i].portfolioStocks[j].currentPrice = stockData[0].currentPrice;
		    this.portfolio.portfolio[i].portfolioStocks[j].openPrice =stockData[0].openPrice;
		    this.portfolio.portfolio[i].portfolioStocks[j].prevClosePrice =stockData[0].prevClosePrice;
		    this.portfolio.portfolio[i].portfolioStocks[j].fiftyTwoWeekHigh =stockData[0].fiftyTwoWeekHigh;
		    this.portfolio.portfolio[i].portfolioStocks[j].fiftyTwoWeekLow =stockData[0].fiftyTwoWeekLow;
		    this.portfolio.portfolio[i].portfolioStocks[j].fiftyTwoWeekPercentage = 100 * ( stockData[0].currentPrice  - stockData[0].fiftyTwoWeekLow ) / ( stockData[0].fiftyTwoWeekHigh - stockData[0].fiftyTwoWeekLow );
		    //the 52wk spread is the % of the high low range when compared to the current price. A large spread means lots of growth (volatility) and a small spread means less growth/volatility
		    this.portfolio.portfolio[i].portfolioStocks[j].fiftyTwoWeekSpread = 100 *( stockData[0].fiftyTwoWeekHigh - stockData[0].fiftyTwoWeekLow ) /  stockData[0].currentPrice;
		    this.portfolio.portfolio[i].portfolioStocks[j].dailyGainLoss = ( stockData[0].currentPrice - stockData[0].prevClosePrice ) * this.portfolio.portfolio[i].portfolioStocks[j].shares;

		    this.portfolio.portfolio[i].portfolioStocks[j].trend =stockData[0].trend;
		}
	    }
	}
    }
}

Reader.prototype.CalculatePortfolioPercentages = function() {
    for ( var i=0;i<this.portfolio.portfolio.length;i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for ( var j=0;j<this.portfolio.portfolio[i].portfolioStocks.length;j++){
		this.portfolio.portfolio[i].portfolioStocks[j].percentageOfPortfolio = ( (this.portfolio.portfolio[i].portfolioStocks[j].currentPrice * this.portfolio.portfolio[i].portfolioStocks[j].shares) / this.portfolio.portfolio[i].portfolioValue ) * 100; 
	    }
	}
    }
}

Reader.prototype.ParseForPieChart = function(valueParam,labelParam) {
//http://www.chartjs.org/docs/#doughnut-pie-chart

    var outputArray = new Array(),
    colorArray=["#000","#111","#222","#333","#444","#555","#666","#777","#888","#999","#aaa","#bbb","#ccc","#ddd","#eee","#fff","#f00","#0f0","#00f","#f0f","#a00","#0a0","#00a","#a0a","#b0b","#c0c","#d0d"];
//    var i = 5; //5 = the Scottrade brokerage acct
    for ( var i=0;i<this.portfolio.portfolio.length;i++){
	if (this.portfolio.portfolio[i].display=="yes" && this.portfolio.portfolio[i].portfolioStocks.length > 14){
	    for ( var j=0;j<this.portfolio.portfolio[i].portfolioStocks.length;j++){
//		var     obj = {highlight: "#FF00BB", value:"",color:"#333",label:""};
		var     obj = {highlight: "#FF00BB", value:"", label:""};

		obj.value=this.portfolio.portfolio[i].portfolioStocks[j][valueParam];
		obj.label=this.portfolio.portfolio[i].portfolioStocks[j][labelParam].toUpperCase();
		obj.color=colorArray[j];
		//I need an array of colors or something (a theme) to use for nice colors. I suppose I could come up with a rainbow and then based on the number of datapoints assign the colors using some algo to index in or create a color

//		console.log(obj)
		outputArray.push(obj);
	    }
	}
    }
//  console.log("PieChart Output Array:",outputArray);
};

Reader.prototype.ReadHistoricalStockData = function(cb) {
    var that = this;
    fs.readFile(this.historicalDataFile, function(err,data){
	if (err) { 
	    if (err.code !== "ENOENT") {
		console.log(err);
		console.log(err.errno+ " "+process.ENOENT);
		throw err;
	    }
	    //	console.log(
	} else {
	    //console.log("no error, reading data");
	    //we need to check that the data is valid json somehow
	    if (data.length > 0) {
		that.historicalStockData = JSON.parse(data);
	    }

	}
	if (typeof cb==='function') {
	    cb();
	}
    });
}

Reader.prototype.WriteHistoricalStockData = function() {
    /*
I was thinking about this all wrong. I was thinking I'd need to first read the file here before writing, reconcile any difference between what was read and what was retrieved and go from there. But I need to read farther upstream before attempting to write. I need to read the file before making any network requests. at that point is when I reconcile the diff btw what I have locally and what I need to get. 
Hmm I may need to periodically check just in case a stock I'm comparing against splits and the adjClose changes. other than that I can't think of a case where I'd need to reupdate data. I should write a separate function to update the historical stock price file. 

    //if file exists, read file...

    //    fs.open("historicalData.txt", "r+", function(err,fd){
    fs.readFile("historicalData.txt", function(err,data){
    if (err) {
    //file doesn't exist, just write out data */
  //console.log(this.historicalDataFile+" "+JSON.stringify(this.historicalStockData));
    fs.writeFile(this.historicalDataFile,JSON.stringify(this.historicalStockData),function(err,wr,bf) {
	if (err){
	    console.log("There was an error while writing to file.");
	} else {
	    console.log("Wrote "+wr+" bytes to "+bf);
	}
    });
    /*	} else {
	var fileContents = JSON.parse(data);
	// ...merge contents of data read from file and historicalStockData 
	//..and write contents back to file.	
	
}
    });
*/
}

//http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
function numberWithCommas(x) {
 
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
} //http://stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places-in-javascript

module.exports = Reader

//run the json data through a handlebars template for HTML output, I suppose json data is good enough for command line display. 

//how to track new purchases from old funds / sales? If I had sold POT to buy NFLX the purchaseDate would screw stuff up. I'd have to add in a new parameter to track things. I'd have to use the old date for the comparison (to SP500) but another date for the gain for that new purchase. 

//It'd be nice to be able to tell the time distance from the 52 wk low and highs. It is better to be closer to the high (time wise) than the low. 

// in resultant webpage : 
//hover on page and ajax call loads company data into a tooltip
//ajax call to download price graph
//ajax call to db to generate price graph

//ajax vs request; what is the difference? 

//graph percentages; log over time growth of holdings AAPL went from X% of my portfolio to Y%
//animate a pie chart over time to show growth; or hover dynamically generates the pie chart such that as you scroll through time you see it change.
//have yearly snapshots of the data with the graph below each bracketed year

// I want to be able to view trends.

//look at flowingdata.com or visual.ly for samples of investment graphics / plots. 

//1,3,5,10yr returns

//Expense Ratio of mutual funds, latest attribution of costs for each and have calculation of costs for year.

//Sample Stock Portfolio Example:
//http://corporate.morningstar.com/us/asp/detail.aspx?xmlfile=333.xml

//What nice features do I have through my TRP acct? WF acct?  Any good investing tools?

//JSON Portfolio changes:
// -add a stock class / category 
// -place notes in an array such that can easily cycle through them for display
// -add a comparator to each. This could be done via the class/category attribute such that each stock can be copmared to something provided benchmark.  Or the overall portfolio could have a comparator attached to it that is applied to all children. 

//Do some cool magic where if there are multiple purchases of the same stock that the data is entered as an array and the data is displayed in aggregate with a + next to it showing that you can expand to show the individual purchases. 

//allow resorting: based on which column clicked, resort.

//instead of computing the percentage of the portfolio that the holding is, heat map color code the portfolio values. This would make more sense if the output was organized by percentage of holdings in each.

// create a pie chart of the holding and when you hover over the slice in the pie, it highlights the relevant line in the data. 

// create a graphic timeline showing a bar when the investment was made with the purchase price and current value as a stacked graph so that you see the power of compound interest.  Or show how over time that initial investment grew ( I suppose this is just a normal "flow" graph of time series data)
// I do like the idea of having the one blip waaay back in time that has a big height due to compounding.  II........i...i..i <-- that is supposed to be that sort of time series graph I'm talking about. 

//a flipcard view of your stocks. Have the cards colored based on how they are doing. flip the card over (ad nauseum) to see different stats.  One view could be the company profile etc. Seems like a gimmicky thing to do but people like gimmicky shit. 

// http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%3D%22' + stocksUrl + '%22&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=  ; use %20 btw individual stock ticker symbols  got this from http://codepen.io/alexerlandsson/pen/YXXzLR

//write a script to change purchaseDate, or somehow standardize the dates for easier comparison

// highlight/alert if price drop by X%

// work out a way to collapse securities together such that all purchases of QQQ are together etc and can be expanded or collapsed
// do teh same for ER adn show all the fees within (although that is a bit much. Just a bit of data entry , but not sure I care that much. Could write a data scraper to do that for me automagically.

//write a front end that reads the json portfolio fil and allows you to edit and create a new entry. It will automagically update the dat e adn set the old display to no etc etc.

//filter the portfolio array instead of having the if (display === "yes"
