var R=require('./reader.js');
var H=require('./helper.js');

if ( 1 == 0 ) {
    
var myReader=new R({portfolioFile:"../../../BB/configfiles/StockTrackerJSON/AllPortfolios.json"});
    myReader.GetCurrentStockData(cb);

}
function cb() {
    console.log(JSON.stringify(myReader.stockData));
}

var myHelper = new H({portfolioFile:"../../../BB/configfiles/StockTrackerJSON/AllPortfolios.json"});
myHelper.GetHistoricalStockData();
