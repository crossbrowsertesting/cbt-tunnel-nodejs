var cbt = require('cbt_tunnels');
var request = require('request');

var authkey = ""; // Place CBT user credentials here
var username = "";

var configObj = {
    authkey: authkey,
    username: username,
}

var baseUrl = 'https://' + configObj.username + ':' + configObj.authkey + '@crossbrowsertesting.com/api/v3/';
console.info("baseUrl: ", baseUrl);

// https://crossbrowsertesting.com/apidocs/v3/livetests.html#!/default/get_livetests

cbt.start(configObj, function(err) {
    if (err) {
        console.error("Error starting: ", err);
        return err;
    }
    var queryUrl = baseUrl + 'livetests?format=json&num=10&active=true&os_type=mac&browser_type=firefox';
    request.get({ url: queryUrl }, function(error, response, body) {
        if (error) {
            console.error("Error posting: ", error);
            return error;
        }

        var livetests = JSON.parse(body).livetests;
        console.log("livetest count: ", livetests.length);

        for (var test of livetests) {
            // do something
        }

        cbt.stop();
        console.log('Exiting!');
        process.exit(0);
    });
});
