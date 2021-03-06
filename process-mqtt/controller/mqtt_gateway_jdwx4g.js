'use strict';
const config = require( "config-lite");
const MqttSubHandle = require("../../mqttclient/subscribe/mqtt_sub.js");
const DB = require( "../../models/models.js");
const dtime = require( 'time-formater');
const logger = require( '../../logs/logs.js');

//每个设备保持记录数
const keep_record_num = config.keep_record_num;


class MqttDeviceJDWX4gHndle {
    constructor(){
        //var s1 = new Set(); // 空Set
        this.hash_data =  new Map();

        this.deviceMessageProcess = this.deviceMessageProcess.bind(this);
        this.updateDeviceInfo = this.updateDeviceInfo.bind(this);
        //this.hash_data = this.hash_data.bind(this);

    }


    // 监听器 #1 ,  每分钟更新1次
    // devunit_name
    async deviceMessageProcess (devunit_name, josnObj) {

        //console.log("receive yunJDWX message");
        if (!josnObj.hasOwnProperty('cmdId')){
            //console.log("not found comdId");
            return;
        }

        switch (josnObj['cmdId']){
            case 103:
                if (josnObj.hasOwnProperty('devList')){
                    this.updateDeviceInfo(devunit_name, josnObj);
                }
                break;
            case 1:
                break;
        }


    }

    // 监听器 #1 ,  每分钟更新1次
    // devunit_name
    async updateDeviceInfo (dev_name, josnObj) {
        let mytime = new Date();
        logger.info('Hello jdwx:', dtime(mytime).format('YYYY-MM-DD HH:mm:ss'), dev_name, JSON.stringify(josnObj));
        //console.log('gwSn:', josnObj['gwSn']);

        // 1. 更新到设备数据库，sysinfo库
        //SysinfoTable
        let devunit_name = dev_name + '_' + josnObj['devList'][0]['devId'];

        /// 向hash表中添加数据
        var list_data = new Map();   //hash表中
        for(let item of josnObj['devList'][0]['varList']) {
            //console.log('item:', item);
            list_data.set(item.varName, item);
        }

        //console.log('add list length:', josnObj['devList'][0]['varList'].length);
        //console.log('map_value_obj size:', map_value_obj['list_data'].size);

        // 1. 更新到设备数据库，Gateway_Real_Table
        let wherestr = { 'devunit_name': devunit_name};
        let updatestr = {
            'devunit_name': devunit_name,
            'devunit_id': '0',    ///id 写死为0， 物通博联的设备需要该字段
            'devunit_local': devunit_name,
            'gateway_sn': josnObj['gwSn'],
            'devunit_type': 'jindawanxiang',
            'devunit_link_status': 'online',
            'update_time':dtime(mytime).format('YYYY-MM-DD HH:mm:ss'),
            'sort_time':mytime.getTime(),
            'logs': [],
            'data': [...list_data.values()],   //集合
        };

        await DB.Gateway_Real_Table.findOneAndUpdate(wherestr, updatestr,{upsert: true}).exec();


        // 2. 更新到设备历史数据库，Gateway_Minute_Table
        logger.info('Hello recordDeviceHistoryInfo');
        DB.Gateway_Minute_Table.create(updatestr);


        //存最近60条记录
        let amount = await DB.Gateway_Minute_Table.count(wherestr);
        if (amount > keep_record_num){
            //删除数据， sort_time  单位：ms
            let old_sort_time = mytime.getTime() - keep_record_num * 60000;
            let wheredel = { 'devunit_name': devunit_name, 'sort_time': {$lt: old_sort_time}};
            logger.info('delete record of Gateway_Minute_Table, condition:', wheredel);
            DB.Gateway_Minute_Table.deleteMany(wheredel).exec();
        }


        logger.info('Hello jdwx exit');
    }

}

const MqttDeviceJDWX4gHnd = new MqttDeviceJDWX4gHndle();


//监听事件some_event
MqttSubHandle.addLoopListener('yunJDWX', MqttDeviceJDWX4gHnd.deviceMessageProcess);
