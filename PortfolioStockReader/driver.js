var R=require('./reader.js');
var H=require('./helper.js');

var mySwitch = 0;
switch (mySwitch)
{
    case 0:
    var myReader=new R({portfolioFile:"../../configfiles/StockTrackerJSON/AllPortfolios.json"});
  myReader.init();
//    myReader.GetCurrentStockData(cb);

    break;
    case 1:
    var myHelper = new H({portfolioFile:"../../configfiles/StockTrackerJSON/AllPortfolios.json"});
    myHelper.GetHistoricalStockData();
    break;
}
    

function cb() {
    console.log(JSON.stringify(myReader.stockData));
}

//I then want to pass back the current stock data and the historical stock data and then use that to formulate the rest of the results
//I need to have the ability to pass in a ticker or array of tickers to compare against. 

