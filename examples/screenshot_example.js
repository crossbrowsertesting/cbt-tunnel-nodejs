var request = require('request'),
	cbt 	= require('cbt_tunnels'),
	username = "", //Place CBT user credentials here
	authkey = "",
	url = 'https://'+username+':'+authkey+'@crossbrowsertesting.com/api/v3/screenshots?browsers=FF42&check_url=true&hide_fixed_elements=true&url=http:%2F%2Fwhatismyip.com',
	running = true;

cbt.start({'username': username,'authkey': authkey},function(err){
	if(!err){
		request.post({url: url}, function(error,response,body){
			if(!error){
				var areWeThereYet = setInterval(function(){
					request.get({url:'https://'+username+':'+authkey+'@crossbrowsertesting.com/api/v3/screenshots/'+JSON.parse(body).screenshot_test_id+'?format=json'},function(err,r,b){
						if(JSON.parse(b).versions[0].active==false){
							clearInterval(areWeThereYet);
							cbt.stop();
							console.log('Took screenshot!');
							process.exit(0);
						}else{
							console.log("Are we there yet?");
						}
					});
				},3000);
			}else{
				console.log(error);
			}
		});
	}else{
		console.log(username);
	}
})