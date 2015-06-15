var fs =require('graceful-fs'),
    request = require('request');

function Helper(parameters){
    this.inputStockList= new Array();
    this.inputPortfolioFile=parameters['portfolioFile'] || 'portfolio.json';
    this.portfolio="";
    this.CreateListOfUniqueStockSymbolsAndDates();
    this.stockData=new Array();    
}


Helper.prototype.CreateListOfUniqueStockSymbolsAndDates = function() {
    this.portfolio = JSON.parse(fs.readFileSync(this.inputPortfolioFile, 'utf8'));
    for ( var i=0;i<this.portfolio.portfolio.length;i++){
	if (this.portfolio.portfolio[i].display=="yes"){
	    for ( var j=0;j<this.portfolio.portfolio[i].portfolioStocks.length;j++){
		var foundFlag=false;
		for ( var k=0;k<this.inputStockList.length;k++){
		    if ( this.inputStockList[k].ticker===this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase() &&
			 this.inputStockList[k].date===this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate ){
			foundFlag=true;
			break;
		    }
		}
		if (foundFlag===false){
		    this.inputStockList.push({
			ticker:this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase(),
			date:this.portfolio.portfolio[i].portfolioStocks[j].purchaseDate
		    });
		}
	    }
	}
    }
};

Helper.prototype.GetHistoricalStockData = function(cb) {
    var that = this,
	completionCounter = 0;
    
    for (var i = 0; i < this.inputStockList.length; i++){
	//	console.log(this.inputStockList[i].date);
	var date = this.inputStockList[i].date.split("/");
	var month = parseFloat(date[0])-1;
	var day = parseFloat(date[1]);
	var dayMinusOne = day -1;
	//https://code.google.com/p/yahoo-finance-managed/wiki/csvHistQuotesDownload formatting doc. 
	var url = "http://ichart.yahoo.com/table.csv?s=" + this.inputStockList[i].ticker +
	    "&a="+ month + 
	    "&b="+ day + 
	    "&c="+ date[2] +
	    "&d="+ month + 
	    "&e="+ day + 
	    "&f="+ date[2] +
	    "&g=&ignore=.csv"
	console.log(date +"myUrl",url);
	var requestOptions= {
	    url:url,
	    headers: {'User-Agent' : 'Mozilla/5.0 (X11; U; Linux i686) Gecko/20071127 Firefox/2.0.0.11' }
	}
	//	console.log(this.inputStockList[i].ticker +"-"+ this.inputStockList[i].ticker.toLowerCase );
	if (this.inputStockList[i].ticker.toLowerCase() !== 'prrxx') {
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
		//console.log(url + " : " +that.inputStockList[i].ticker+" "+that.inputStockList[i].date+"=-> " +body/*data[1]*/);
		var stockData = data[1].split(",");

		
		that.stockData.push({ticker:that.inputStockList[i].ticker,
				     date:stockData[0],
				     openPrice:stockData[1],
				     highPrice:stockData[2],
				     lowPrice:stockData[3],
				     closePrice:stockData[4],
				     volume:stockData[5],
				     adjClose:stockData[6]
				    });
		console.log(JSON.stringify(that.stockData[that.stockData.length-1]));
		completionCounter++;
		//ensure that all requests complete before executing callback
		if (completionCounter==that.inputStockList.length){
		    //			console.log(JSON.stringify(that.stockData));
		    if (cb) {
			cb();
		    }
		    //	return that.stockData; nope this doesn't work how I'd like it to
		}
            }
								    })(i,requestOptions.url)
				   );
	}	

    }
    
};

module.exports = Helper
