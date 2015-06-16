var R=require('./reader.js');
var H=require('./helper.js');

var mySwitch = 0;
switch (mySwitch)
{
    case 0:
    var myReader=new R({portfolioFile:"../../../BB/configfiles/StockTrackerJSON/AllPortfolios.json"});
    myReader.GetCurrentStockData(cb);
    break;
    case 1:
    var myHelper = new H({portfolioFile:"../../../BB/configfiles/StockTrackerJSON/AllPortfolios.json"});
    myHelper.GetHistoricalStockData();
    break;
}
    

function cb() {
    console.log(JSON.stringify(myReader.stockData));
}
