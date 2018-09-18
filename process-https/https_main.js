'use strict';
const db = require('../mongodb/db.js');
const express = require('express');
const config = require('config-lite');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const history = require('connect-history-api-fallback');
const web_router = require('./routes/entry_index');
//const mqttClient = require('../mqttclient/mqttclient.js');
//const mqtt_router = require('./routes-mqtt/entry_index.js');
const path = require('path');
const https = require('https');
const fs = require("fs");


//固件存放位置， 不存在则创建
fs.exists(config.firmware_dir, function(exists) {
    console.log(exists ? "固件目录存在" : "固件目录不存在", config.firmware_dir);
    if (!exists) fs.mkdirSync(config.firmware_dir);
});


//excel导入文件存放位置， 不存在则创建
fs.exists(config.device_dir, function(exists) {
    console.log(exists ? "设备excel目录存在" : "设备excel目录不存在", config.device_dir);
    if (!exists) fs.mkdirSync(config.device_dir);
});


//插件存放位置， 不存在则创建
fs.exists(config.pkg_dir, function(exists) {
    console.log(exists ? "插件目录存在" : "插件目录不存在", config.pkg_dir);
    if (!exists) fs.mkdirSync(config.pkg_dir);
});

//脚本存放位置， 不存在则创建
fs.exists(config.script_dir, function(exists) {
    console.log(exists ? "脚本目录存在" : "脚本目录不存在", config.script_dir);
    if (!exists) fs.mkdirSync(config.script_dir);
});

const app = express();

app.all('*', (req, res, next) => {
	res.header("Access-Control-Allow-Origin", req.headers.origin || '*');
	res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
	res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  	res.header("Access-Control-Allow-Credentials", true); //可以带cookies
    //res.setHeader("Set-Cookie", ["type=ninja", "language=javascript"]);
	res.header("X-Powered-By", '3.2.1')
	if (req.method == 'OPTIONS') {
	  	res.send(200);
	} else {
		//console.log('method:', req.method)
		/*
        req.on('data', function (data) {
            console.log('entry, url:', req.hostname + req.path, ';body data', data.toString());
        });
        */
	    next();
	}
});

// app.use(Statistic.apiRecord)
//连接数据库
const MongoStore = connectMongo(session);

// 使用中间件解析body
// body-parser 能处理 text/plain, application/json和application/x-www-form-urlencoded的数据，解析完放到req.body里。
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(cookieParser());
app.use(session({
	  	name: config.session.name,
		secret: config.session.secret,
		resave: true,
		saveUninitialized: false,
		cookie: config.session.cookie,
		store: new MongoStore({
	  	url: config.url
	})
}))
app.use(function(req, res, next){
	req.session._garbage = Date();
	req.session.touch();
	next();
});

//注册路由分发
web_router(app);

//注册mqtt分发
//mqtt_router(mqttClient);


app.use(history());

//通过 Express 内置的 express.static 可以方便地托管静态文件，例如图片、CSS、JavaScript 文件等。
app.use(express.static('./public'));
app.use(express.static(path.join(__dirname,'../public/dist')))
app.get('*',function(req,res){
	const html = fs.readFileSync(path.resolve(__dirname,'../public/dist/index.html'),'utf8');
	res.send(html);
});
//app.listen(config.port);
var options = {
	key:fs.readFileSync(path.join(__dirname,config.ssl.key),'utf8'),
	cert:fs.readFileSync(path.join(__dirname,config.ssl.cert),'utf8')
};
https.createServer(options,app).listen(config.ssl.port)

console.log('Https listening at ' + config.ssl.port);

