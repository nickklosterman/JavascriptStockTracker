var fs = require('graceful-fs'),
    //    sqlite3 = require('sqlite3'), look at tumblr for sqlite stuff
//    q = require('q'),
    request = require('request');

function Reader(parameters){
    this.currentStockData=new Array();    
    this.historicalStockData=new Array();
    this.uniqueSymbolAndDatesArray=new Array();
    this.outputDB=parameters['databaseName'] || 'temp.sqlite3';
    this.inputPortfolioFile=parameters['portfolioFile'] || 'portfolio.json';

//in memory json portfolio
//    this.portfolio = JSON.parse(fs.readFileSync(this.inputPortfolioFile, 'utf8'));
    this.portfolio="";
    this.completionCounter = 0;
    this.completionsNeeded = 0;
    this.stockList= new Array();
 // this.CreateListOfUniqueStockSymbols();

    this.purchaseDateList = new Array();
//  this.CreateListOfUniquePurchaseDates();
    //    this.PrintUniqueTickers();

   // this.CalculatePurchaseSharePrice();
}

Reader.prototype.callbackStack = function() {
    this.CalculateGains(); 
    this.PortfolioCalculateGains();
//    console.log("cSD_cbs 1:",this.currentStockData);
    this.ComputeAnnualizedReturn(); // this.currentStockData is getting jacked up somehow in here
  //  console.log("cSD_cbs 2:",this.currentStockData);
    this.TotalPortfolioGains();
        this.TotalPortfolioPurchasePrice();
//    console.log("output:",this.portfolio);
    console.log(JSON.stringify(this.portfolio));

}

Reader.prototype.CheckComplete = function() {
    this.completionCounter+=1;
    console.log("cC:"+this.completionCounter);
    if (this.completionCounter==this.completionsNeeded){
	console.log("calling cbS");
	this.callbackStack();
    }

}

Reader.prototype.init = function() {
        this.completionsNeeded = 2;
    this.portfolio = JSON.parse(fs.readFileSync(this.inputPortfolioFile, 'utf8'));
    this.CreateListOfUniqueStockSymbols();
    this.CreateListOfUniquePurchaseDates();
    this.CreateListOfUniqueStockSymbolsAndDates();
    this.CalculatePurchaseSharePrice();
    this.CalculateHoldingTimePeriod()

    //Asynch call
    this.GetCurrentStockData(this.CheckComplete.bind(this)/*this.CalculateGains.bind(this)*/);
    //Asynch call
    this.GetHistoricalStockData(this.CheckComplete.bind(this)/*this.callbackStack.bind(this)*/)
    var that = this;/*
    this.GetCurrentStockData(
	(function(cb,arg) {
	    //this.GetHistoricalStockData(this.callbackStack.bind(this))
	    that.GetHistoricalStockData(cb);
	})(that.callbackStack.bind(that))
    );*/
    
/*    
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
  //  this.portfolio = JSON.parse(fs.readFileSync(this.inputPortfolioFile, 'utf8'));

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
		  //this.stockList.push({ticker:this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase()});
                  this.stockList.push(this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase() );
		}
	    }
	}
    }
}

//This is needed to efficiently perform the comparison to the benchmark
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
		  //this.purchaseDateList.push({purchaseDate:this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate});
this.purchaseDateList.push(this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate);
		}
	    }
	}
    }
}


//why stick the data in a sqlitedb when the db would be temp anyway. just save the data off in a flatafile/json object
Reader.prototype.GetCurrentStockData = function(cb) {
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
//	    url:'http://download.finance.yahoo.com/d/quotes.csv?s=' + this.stockList[i].ticker + '&f=l1opwt7',
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
		//			 that.saveFile(filename,url);//call ourself again if there was an error (mostlikely due to hitting the server too hard)
		//use settimeout and call yourself?
	    }
	    //	    console.log(resp);
//	    	    console.log(url);
	    //	    console.log(i);
	    
//	    console.log(that.stockList[i]+" " +body);
	    var split = body.replace(/\"/g,"").replace(/\n/,"").split(",");
	    
	    var lowHigh=split[3].split(" - "),
		low=lowHigh[0] || ""
	    high=lowHigh[1] || "";
	    that.currentStockData.push({ticker:that.stockList[i],
				 currentPrice:split[0],
				 openPrice:split[1],
				 prevClosePrice:split[2],
				 fiftyTwoWeekLow:low,
				 fiftyTwoWeekHigh:high,
				 trend:split[4],
				 date:myDateString
				});
//	    console.log(JSON.stringify(that.currentStockData[that.currentStockData.length-1]));
	    completionCounter++;
	    //ensure that all requests complete before executing callback
	    if (completionCounter==that.stockList.length){
		//		console.log(JSON.stringify(that.currentStockData));
		console.log("getCurrentStockData done");
//		console.log("cSD:",that.currentStockData);
		if (cb) {
		    cb();
		}
		//	return that.currentStockData; nope this doesn't work how I'd like it to
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
                    return item.ticker === currentStockTicker; // 'this' context changes so I created currentStockTicker
                });
		if ( stockData.length == 0 ){ console.log("shit:"+currentStockTicker);} else {
		    //console.log(stockData[0].currentPrice);
		    this.portfolio.portfolio[i].portfolioStocks[j].dollarGain =  stockData[0].currentPrice * parseFloat(this.portfolio.portfolio[i].portfolioStocks[j].shares) - parseFloat(this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice) ;
		    var temp = this.portfolio.portfolio[i].portfolioStocks[j].dollarGain / parseFloat(this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice);
		    if ( temp == null ) {
			console.log("Derp");}
		    if (temp == 'null') {
			console.log("darp");
		    }
		    this.portfolio.portfolio[i].portfolioStocks[j].percentGain = temp == null ? Infinity : temp;
		}
	    }
	}
    }
//console.log(JSON.stringify(this.portfolio));
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
        dailyLosses = 0
    totalCommissionPaid = 0,
    totalPurchasePrice = 0,
      totalGainLoss = 0,
          totalGains = 0,
    totalLosses = 0, 
    portfolioValue = 0;
      if ( this.portfolio.portfolio[i].display == 'yes'){
    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
/*      var stockData = this.currentStockData.filter( function(item) {
                        return item.ticker === this.portfolio.portfolio[i].portfolioStocks[j].ticker
                      });
      this.portfolio.portfolio[i].portfolioStocks[j].dollarGain = this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice - stockData.currentPrice * this.portfolio.portfolio[i].portfolioStocks[j].shares;
      this.portfolio.portfolio[i].portfolioStocks[j].percentGain = this.portfolio.portfolio[i].portfolioStocks[j].dollarGain / this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice;
this code is for each stock, not for the portfolio itself.
*/
      if ( this.portfolio.portfolio[i].portfolioStocks[j].dollarGain > 0) {
        totalGains+=this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;
      } else {
        totalLosses += this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;
      }
      totalGainLoss += this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;
      totalCommissionPaid += this.portfolio.portfolio[i].portfolioStocks[j].commissionPaid;
      totalPurchasePrice += this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice;
      portfolioValue += this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice + this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;

    }
      this.portfolio.portfolio[i].portfolioGains = totalGainLoss;//dollarGains;
      }
  }
}
/*
Reader.prototype.CalculatePercentGains = function(){
  for (var i=0; i<this.portfolio.portfolio.length; i++){
    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
      var stockData = this.currentStockData.filter( function(item) {
                        return item.ticker === this.portfolio.portfolio[i].portfolioStocks[j].ticker
                      });
      this.portfolio.portfolio[i].portfolioStocks[j].dollarGain =  this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice - stockData.currentPrice * this.portfolio.portfolio[i].portfolioStocks[j].shares;
    }
  }
}*/


Reader.prototype.CalculateHoldingTimePeriod____ = function(stockItem) {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
    var now = new Date.now(), //time in ms
	purchaseDate,
	purchaseYear,
	purchaseMonth,
	purchaseDay,
	elapsedMilliseconds,
	elapsedYears;
   
    purchaseDate = new Date(stockItem.purchaseDate);//purchaseYear,purchaseMonth,purchaseDay);
    elapsedMilliseconds = now - purchaseDate;
    elapsedYears = elapsedMilliseconds / (365*24*60*60*1000);
    
    return elapsedYears;
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
	return value.ticker === stockItem.ticker;
    });
    if (currentSharePriceArray.length > 0){
//	console.log("cSPA[0]:"+currentSharePriceArray[0])
    var endingValue = parseFloat(stockItem.shares) * parseFloat(currentSharePriceArray[0].currentPrice) /* - stockItem.commissionToSell */;

    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/pow
    //    var annualizedReturn = Math.pow( ( endingValue - stockItem.totalPurchasePrice ) / stockItem.totalPurchasePrice + 1 , 1/this.CalculateHoldingTimePeriod(stockItem) )*100;
  //  console.log(endingValue + " "+ stockItem.totalPurchasePrice+1 +" "+ stockItem.totalPurchasePrice + 1 + " " +stockItem.holdingTimePeriodInYears );
	annualizedReturn = (Math.pow( ( endingValue - parseFloat(stockItem.totalPurchasePrice) ) / parseFloat(stockItem.totalPurchasePrice) + 1 , 1/stockItem.holdingTimePeriodInYears ) -1)*100;
    }
    return annualizedReturn;
// formula from python version    ARR=(((self.dollarGain/self.totalpurchaseprice+1)**(1/self.yearsSincePurchase()) -1 ) *100) 
    
}
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
}

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


Reader.prototype.CreateListOfUniqueStockSymbolsAndDates = function() {
    
    for ( var i=0;i<this.portfolio.portfolio.length;i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for ( var j=0;j<this.portfolio.portfolio[i].portfolioStocks.length;j++){
		var foundFlag=false;
		for ( var k=0;k<this.uniqueSymbolAndDatesArray.length;k++){
		    if ( this.uniqueSymbolAndDatesArray[k].ticker===this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase() &&
			 this.uniqueSymbolAndDatesArray[k].date===this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate ){
			foundFlag=true;
			break;
		    }
		}
		//add data if matching data not found
		if (foundFlag===false){
		    this.uniqueSymbolAndDatesArray.push({
			ticker:this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase(),
			date:this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate
		    });
		}
	    }
	}
    }
};

Reader.prototype.GetHistoricalStockData = function(cb) {
    var that = this,
	completionCounter = 0;
    
    for (var i = 0; i < this.uniqueSymbolAndDatesArray.length; i++){
	//	console.log(this.uniqueSymbolAndDatesArray[i].date);
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
		//console.log(url + " : " +that.uniqueSymbolAndDatesArray[i].ticker+" "+that.uniqueSymbolAndDatesArray[i].date+"=-> " +body/*data[1]*/);
		var stockData = data[1].split(",");

		
		that.historicalStockData.push({ticker:that.uniqueSymbolAndDatesArray[i].ticker,
				     date:stockData[0],
				     openPrice:stockData[1],
				     highPrice:stockData[2],
				     lowPrice:stockData[3],
				     closePrice:stockData[4],
				     volume:stockData[5],
				     adjClose:stockData[6]  // <-- adjClose is the split adjusted price
				    });
//		console.log(JSON.stringify(that.currentStockData[that.currentStockData.length-1]));
		completionCounter++;
//		console.log(completionCounter+" "+that.uniqueSymbolAndDatesArray.length);
		//ensure that all requests complete before executing callback
		if (completionCounter==that.uniqueSymbolAndDatesArray.length){
		    //			console.log(JSON.stringify(that.currentStockData));
		    console.log("getHistoricalStockData done");
//		    console.log(JSON.stringify(that.historicalStockData));
		    if (typeof cb==='function') {
			cb();
		    }
		    //	return that.currentStockData; nope this doesn't work how I'd like it to
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

module.exports = Reader

//run the json data through a handlebars template for HTML output, I suppose json data is good enough for command line display. 
