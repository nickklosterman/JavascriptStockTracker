var fs = require('graceful-fs'),
    //    sqlite3 = require('sqlite3'), look at tumblr for sqlite stuff
    request = require('request');

function Reader(parameters){
    this.stockList= new Array();
    this.outputDB=parameters['databaseName'] || 'temp.sqlite3';
    this.inputPortfolioFile=parameters['portfolioFile'] || 'portfolio.json';
    this.portfolio="";
    this.CreateListOfUniqueStockSymbols();
    //    this.PrintUniqueTickers();
    this.stockData=new Array();    
}
Reader.prototype.PrintUniqueTickers = function() {
    for (var i = 0; i<this.stockList.length; i++){
	console.log(this.stockList[i].ticker);
    }
};
Reader.prototype.CreateListOfUniqueStockSymbols = function() {
    this.portfolio = JSON.parse(fs.readFileSync(this.inputPortfolioFile, 'utf8'));

    this.stockList.push({ticker:"^DJI"});
    this.stockList.push({ticker:"^gspc"});
    this.stockList.push({ticker:"^ixic"});
    
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
		    if (this.stockList[k].ticker===this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase()){
			foundFlag=true;
			break;
		    }
		}
		if (foundFlag===false){
		    this.stockList.push({ticker:this.portfolio.portfolio[i].portfolioStocks[j].ticker.toLowerCase()});
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
	    url:'http://download.finance.yahoo.com/d/quotes.csv?s=' + this.stockList[i].ticker + '&f=l1opwt7',
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
	    
	    console.log(that.stockList[i].ticker+" " +body);
	    var split = body.replace(/\"/g,"").replace(/\n/,"").split(",");
	    
	    var lowHigh=split[3].split(" - "),
		low=lowHigh[0] || ""
	    high=lowHigh[1] || "";
	    that.stockData.push({ticker:that.stockList[i].ticker,
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



module.exports = Reader
