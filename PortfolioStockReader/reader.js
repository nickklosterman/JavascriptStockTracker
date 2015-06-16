var fs = require('graceful-fs'),
    //    sqlite3 = require('sqlite3'), look at tumblr for sqlite stuff
    request = require('request');

function Reader(parameters){
    this.stockData=new Array();    

    this.outputDB=parameters['databaseName'] || 'temp.sqlite3';
    this.inputPortfolioFile=parameters['portfolioFile'] || 'portfolio.json';

//in memory json portfolio
//    this.portfolio = JSON.parse(fs.readFileSync(this.inputPortfolioFile, 'utf8'));
    this.portfolio="";



    this.stockList= new Array();
 // this.CreateListOfUniqueStockSymbols();

this.purchaseDateList = new Array();
//  this.CreateListOfUniquePurchaseDates();
    //    this.PrintUniqueTickers();

   // this.CalculatePurchaseSharePrice();
}

Reader.prototype.init = function() {
  this.portfolio = JSON.parse(fs.readFileSync(this.inputPortfolioFile, 'utf8'));
  this.CreateListOfUniqueStockSymbols();
  this.CreateListOfUniquePurchaseDates();

this.GetCurrentStockData(this.CalculateGains.bind(this));

// this.CalculatePurchaseSharePrice();
console.log("this.portfolio");
console.log(JSON.stringify(this.portfolio));
console.log("this.stockList");
console.log(JSON.stringify(this.stockList.sort()));
console.log("this.purchaseDateList");
console.log(JSON.stringify(this.purchaseDateList.sort()));
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
	    //	    console.log(url);
	    //	    console.log(i);
	    
	    console.log(that.stockList[i]+" " +body);
	    var split = body.replace(/\"/g,"").replace(/\n/,"").split(",");
	    
	    var lowHigh=split[3].split(" - "),
		low=lowHigh[0] || ""
	    high=lowHigh[1] || "";
	    that.stockData.push({ticker:that.stockList[i],
				 currentPrice:split[0],
				 openPrice:split[1],
				 prevClosePrice:split[2],
				 fiftyTwoWeekLow:low,
				 fiftyTwoWeekHigh:high,
				 trend:split[4],
				 date:myDateString
				});
	    //	    console.log(JSON.stringify(that.stockData[that.stockData.length-1]));
	    completionCounter++;
	    //ensure that all requests complete before executing callback
	    if (completionCounter==that.stockList.length){
		//		console.log(JSON.stringify(that.stockData));
		cb();
		//	return that.stockData; nope this doesn't work how I'd like it to
	    }
        }
								})(i,requestOptions.url)
			       );

    }
    //  console.log(JSON.stringify(outputArray));
    
}

//Reader.prototype.CalculateDollarGains = function(){
Reader.prototype.CalculateGains = function(){
  for (var i=0; i<this.portfolio.portfolio.length; i++){
    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
      var currentStockTicker = this.portfolio.portfolio[i].portfolioStocks[j].ticker;
      var stockData = this.stockData.filter( function(item) {
                        return item.ticker === currentStockTicker; //this context changes
                      });
      this.portfolio.portfolio[i].portfolioStocks[j].dollarGain = parseFloat(this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice) - stockData.currentPrice * parseFloat(this.portfolio.portfolio[i].portfolioStocks[j].shares);
      this.portfolio.portfolio[i].portfolioStocks[j].percentGain = this.portfolio.portfolio[i].portfolioStocks[j].dollarGain / this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice;
    }
  }
console.log(JSON.stringify(this.portfolio));
}


Reader.prototype.PortfolioCalculateGains = function(){
  for (var i=0; i<this.portfolio.portfolio.length; i++){
    var dailyGains = 0,
        dailyLosses = 0
    totalCommissionPaid = 0,
    totalPurchasePrice = 0,
    totalGains = 0,
    totalLosses = 0, 
    portfolioValue = 0;

    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
/*      var stockData = this.stockData.filter( function(item) {
                        return item.ticker === this.portfolio.portfolio[i].portfolioStocks[j].ticker
                      });
      this.portfolio.portfolio[i].portfolioStocks[j].dollarGain = this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice - stockData.currentPrice * this.portfolio.portfolio[i].portfolioStocks[j].shares;
      this.portfolio.portfolio[i].portfolioStocks[j].percentGain = this.portfolio.portfolio[i].portfolioStocks[j].dollarGain / this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice;
this code is for each stock, not for the portfolio itself.
*/
      if ( this.portfolio.portfolio[i].portfolioStocks[j].dollarGain > 0) {
        totalGains+=this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;
      } else {
        toalLosses += this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;
      }
      totalGainLoss += this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;
      totalCommissionPaid += this.portfolio.portfolio[i].portfolioStocks[j].commissionPaid;
      totalPurchasePrice += this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice;
      portfolioValue += this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice + this.portfolio.portfolio[i].portfolioStocks[j].dollarGain;

    }
    this.portfolio.portfolio[i].portfolioGains = dollarGains;
  }
}
/*
Reader.prototype.CalculatePercentGains = function(){
  for (var i=0; i<this.portfolio.portfolio.length; i++){
    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
      var stockData = this.stockData.filter( function(item) {
                        return item.ticker === this.portfolio.portfolio[i].portfolioStocks[j].ticker
                      });
      this.portfolio.portfolio[i].portfolioStocks[j].dollarGain =  this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice - stockData.currentPrice * this.portfolio.portfolio[i].portfolioStocks[j].shares;
    }
  }
}*/

//if a piece of the puzzle is missing have it call the missing piece with itself as a callback so that it gets run upon completion of the missing piece.
Reader.prototype.CalculateAnnualizedReturn = function(stockItem) {
    
    //I believe that I should take into account the commissionToSell in the calculation (and taxes) to truly calculate annualized return)
    
    //use filter to find matching stock https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
    var currentSharePriceArray = this.stockData.filter( function(value){
	return value.ticker = stockItem.ticker;
    });
    var endingValue = stockItem.shares * currentSharePriceArray[0].sharePrice /* - stockItem.commissionToSell */;

    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/pow
    //    var annualizedReturn = Math.pow( ( endingValue - stockItem.totalPurchasePrice ) / stockItem.totalPurchasePrice + 1 , 1/this.CalculateHoldingTimePeriod(stockItem) )*100;
        var annualizedReturn = Math.pow( ( endingValue - stockItem.totalPurchasePrice ) / stockItem.totalPurchasePrice + 1 , 1/stockItem.holdingTimePeriodInYears )*100;
    
    return annualizedReturn;
// formula from python version    ARR=(((self.dollarGain/self.totalpurchaseprice+1)**(1/self.yearsSincePurchase()) -1 ) *100) 
    
}

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
   
    var now = new Date.now();

    for (var i=0; i<this.portfolio.portfolio.length; i++){
	    for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
		var pD = new Date(this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate); // "10/23/2003" 
		this.portfolio.portfolio[i].portfolioStocks[j].holdingTimePeriodInYears = ( now - pD ) / ( 365 * 24 * 3600 * 1000);

	}
    }
}

Reader.prototype.ComputeReturn = function(){
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
	    this.portfolio.portfolio[i].portfolioStocks[j].annualizedReturn = this.CalculateAnnualizedReturn( this.portfolio.portfolio[i].portfolioStocks[j] );
	}
    }
}

Reader.prototype.CalculatePurchaseSharePrice = function(){
    for (var i=0; i<this.portfolio.portfolio.length; i++){
	for (var j=0; j<this.portfolio.portfolio[i].portfolioStocks.length; j++){
	    if (typeof this.portfolio.portfolio[i].portfolioStocks[j].sharePrice !== 'undefined') {
		this.portfolio.portfolio[i].portfolioStocks[j].sharePrice = ( this.portfolio.portfolio[i].portfolioStocks[j].totalPurchasePrice - this.portfolio.portfolio[i].portfolioStocks[j].commissionToBuy ) / this.portfolio.portfolio[i].portfolioStocks[j].shares;
	    }
	}
    }
}

module.exports = Reader

//run the json data through a handlebars template for HTML output, I suppose json data is good enough for command line display. 