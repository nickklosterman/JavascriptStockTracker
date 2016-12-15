var R=require('./reader.js');
var H=require('./helper.js');

var mySwitch = 2;
console.log("Running case "+mySwitch);
switch (mySwitch)
{
    case 0:
    var myReader=new R({portfolioFile:"../../../BB/configfiles/StockTrackerJSON/AllPortfolios.json"});
  myReader.init();
//    myReader.GetCurrentStockData(cb);

    break;
    case 1:
    var myHelper = new H({portfolioFile:"../../../BB/configfiles/StockTrackerJSON/AllPortfolios.json"});
//    myHelper.GetHistoricalStockData();
    //    myHelper.CreateListOfUniqueStockSymbols();
        myHelper.CreateListOfUniqueStockSymbolsV2(false);
    //    console.log(JSON.stringify(myHelper.inputStockList));
    console.log(JSON.stringify(myHelper.uniqueStockList.sort()));
    break;
  case 2:
    var myReader = new R({portfolioFile:"../TestPortfolio1.json"});
    myReader.init();
    break;
  case 3:
    var myReader = new R({portfolioFile:"../TestPortfolio2.json"});
    myReader.init();
    break;
}
    

function cb() {
    console.log(JSON.stringify(myReader.stockData));
}

//I then want to pass back the current stock data and the historical stock data and then use that to formulate the rest of the results
//I need to have the ability to pass in a ticker or array of tickers to compare against. 

