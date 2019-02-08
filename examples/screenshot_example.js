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

cbt.start(configObj, function(err) {
    if (err) {
        console.error("Error starting: ", err);
        return err;
    }
    var url = baseUrl + 'screenshots?browsers=FF42&check_url=true&hide_fixed_elements=true&url=http:%2F%2Fwhatismyip.com';
    request.post({ url: url }, function(error, response, body) {
        if (error) {
            console.error("Error posting: ", error);
            return error;
        }
				var screenshotTestUrl = baseUrl + 'screenshots/' + JSON.parse(body).screenshot_test_id + '?format=json';
				
        var areWeThereYet = setInterval(function() {
            request.get({ url: screenshotTestUrl }, function(err, r, b) {
								if (err) {
										console.error("Error retrieving screenshot test data: ", err);
										return err;
								}
                if (!JSON.parse(b).versions[0].active) {
                    clearInterval(areWeThereYet);
                    cbt.stop();
                    console.log('Took screenshot!');
                    process.exit(0);
                } else {
                    console.log("Are we there yet?");
                }
            });
        }, 3000);
    });
});
