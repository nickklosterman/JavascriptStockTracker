var R=require('./reader.js'),
    H=require('./helper.js'),
    myReader,
    myHelper;

var mySwitch = 0;
switch (mySwitch)
{
    case 0:
    myReader=new R({portfolioFile:"../../configfiles/StockTrackerJSON/AllPortfolios.json"});
  myReader.init();
//    myReader.GetCurrentStockData(cb);

    break;
    case 1:
     myHelper = new H({portfolioFile:"../../configfiles/StockTrackerJSON/AllPortfolios.json"});
    myHelper.GetHistoricalStockData();
    break;
  case 2:
    myReader = new R({portfolioFile:"../TestPortfolio2.json",alternateDate:{day:"4",month:"2",year:"2015"}});
    myReader.init();
    break;
  case 3:
    myReader = new R({portfolioFile:"../TestPortfolio2.json"});
    myReader.init();
    break;
    case 4: //use to output just the display:yes portfolios
    myReader = new R({portfolioFile:"../../configfiles/StockTrackerJSON/AllPortfolios.json"});
    myReader.initializePortfolio();
    myReader.OutputDisplayedPortfolios();
    break;
}
    

function cb() {
    console.log(JSON.stringify(myReader.stockData));
}

//I then want to pass back the current stock data and the historical stock data and then use that to formulate the rest of the results
//I need to have the ability to pass in a ticker or array of tickers to compare against. 

