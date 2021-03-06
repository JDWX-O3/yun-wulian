'use strict';
//const MqttPubHandle = require('../../../mqttclient/publish/mqtt_pub.js');
//const MqttSubHandle = require("../../../mqttclient/subscribe/mqtt_sub.js");
const DB = require( "../../../models/models.js");
const dtime = require( 'time-formater');
const config = require( "config-lite");
const logger = require( '../../../logs/logs.js');
const fs = require("fs");
const path = require('path');
const MqttPubHandle = require('../../../mqttclient/publish/mqtt_pub.js');
const MqttSubHandle = require("../../../mqttclient/subscribe/mqtt_sub.js");

class CmdProcHandle {
	constructor(){
        //logger.info('RomPkgHandle constructor...');
        this.trigger_reactor = this.trigger_reactor.bind(this);
        this.record_operate_log = this.record_operate_log.bind(this);

	}


    async exec_shell_cmd(req, res, next){
        logger.info('cmd exec_shell_cmd');

        //获取表单数据，josn
        var route_mac = req.body['route_mac'];
        var shell_cmd = req.body['shell_cmd'];


        //logger.info(req.hostname , req.url, req.protocol, req.ip);
        logger.info('route_mac:', route_mac, shell_cmd);


        //支持批量任务下发
        var taskHandle = await MqttPubHandle.createTaskHandle(req.session.user_account, 'NA', route_mac);
        //执行固件升级命令
        var taskid = await MqttPubHandle.CMD_SHELL.linux(taskHandle, shell_cmd);
        //res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: taskid});


        // 监听器, 更新任务结果，在updateResponse 中
        // 正常升级过程中没有回应消息，需要起定时器进行查询升级结果
        var listener = async function (mac, josnObj) {
            logger.info('Hello listener:', josnObj);
            //timeout, 命令下发后，router进行升级，不回应该消息，timeout认为success
            if (mac == -1 || josnObj == "timeout") {
                res.send({ret_code: -1, ret_msg: '执行超时', extra: taskid});
            }
            //成功的状态为0
            else if (josnObj['retcode'] == "0") {
                res.send({ret_code: 0, ret_msg: '成功', extra: josnObj['retmsg']});
            }
            else{
                res.send({ret_code: -1, ret_msg: '失败', extra: josnObj});
                return;
            }

        };
        //监听下发任务的结果, 超时5000ms
        //监听下发任务的结果
        await MqttSubHandle.addOnceListener(taskHandle['uuid'], listener, 10000);

    }


    async exec_remote_ssh(req, res, next) {
        logger.info('cmd exec_remote_ssh');

        //获取表单数据，josn
        var id = req.body['_id'];
        //var file_name = req.body['file_name'];

        //参数有效性检查
        if(typeof(id)==="undefined" ){
            res.send({ret_code: 1002, ret_msg: '用户输入参数无效', extra:''});
            return;
        }

        //logger.info('romDocObj fields: ', romDocObj);
        //设置上架状态
        var updatestr = {'rom_status': 'normal'};
        var query = await DB.RomTable.findByIdAndUpdate(id, updatestr);
        res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: query});

    }

    async exec_remote_reboot(req, res, next) {
        logger.info('cmd exec_remote_reboot');

        //获取表单数据，josn
        var id = req.body['_id'];
        //var file_name = req.body['file_name'];

        //参数有效性检查
        if(typeof(id)==="undefined" ){
            res.send({ret_code: 1002, ret_msg: '用户输入参数无效', extra:''});
            return;
        }

        //logger.info('romDocObj fields: ', romDocObj);
        //设置上架状态
        var updatestr = {'rom_status': 'normal'};
        var query = await DB.RomTable.findByIdAndUpdate(id, updatestr);
        res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: query});

    }

    async trigger_reactor(number1, if_operate_symbol, number2){

        if (if_operate_symbol == '>' && number1 > number2){
            return true;
        }
        else if (if_operate_symbol == '<' && number1 < number2){
            return true;
        }
        else if (if_operate_symbol == '=' && number1 == number2){
            return true;
        }
        else if (if_operate_symbol == '!=' && number1 != number2){
            return true;
        }
        else{
            return false;
        }
    }


    // 记录操作日志
    async record_operate_log(req, res, next) {
        logger.info('cmd record_operate_log');


        //获取表单数据，josn
        var devunit_name = req.body['devunit_name'];
        var var_name = req.body['var_name'];
        var var_value = req.body['var_value'];

        let wherestr = {
            'logs_type': "操作日志",
            'var_name': var_name,
            'devunit_name': devunit_name
        };

        //触发器的列表
        let triggerList = await DB.DevunitTriggerTable.find(wherestr).exec();
        if (triggerList.length == 0){
            next();
        }

        let mytime = new Date();
        let update_time = dtime(mytime).format('YYYY-MM-DD HH:mm:ss');

        // /实时数据中的变量列表
        for(let m = 0; m < triggerList.length; m++) {
            let dev_cn_name = triggerList[m].dev_cn_name;
            let number2 = triggerList[m].if_number;
            let if_operate_symbol = triggerList[m].if_symbol;
            let if_true_comment = triggerList[m].if_true_comment;
            let if_false_comment = triggerList[m].if_false_comment;


            // 数据有变化，根据触发条件记录日志
            let updatestr = {
                'user_account': req.session.user_account,
                'dev_cn_name': dev_cn_name,
                'devunit_name': devunit_name,
                'var_name': var_name,
                'var_value': var_value,
                'comment': '',
                'sort_time': mytime.getTime(),
                'update_time': update_time,
            };

            // 触发器判断， if判断   if true 的判断
            if (this.trigger_reactor(var_value, if_operate_symbol, number2) && if_true_comment.length > 0){
                //记录日志
                updatestr['comment'] = if_true_comment;
            }

            // 触发器判断, else 判断
            if ( !this.trigger_reactor(var_value, if_operate_symbol, number2) && if_false_comment.length > 0){
                //记录日志
                updatestr['comment'] = if_false_comment;
            }


            // 记录日志到数据库
            if (updatestr['comment'] != '') {
                //console.log("[timer][alarmlog], record log, devunit_name:", devunit_name," updatestr:", updatestr);
                //生成告警日志
                DB.DevunitOperateLogsTable.create(updatestr);
            }
        }

        //继续处理
        next();
    }
    async exec_remote_set(req, res, next) {
        logger.info('cmd exec_remote_set');


        //获取表单数据，josn
        var gw_sn = req.body['gw_sn'];
        var devunit_name = req.body['devunit_name'];
        var var_name = req.body['var_name'];
        var devunit_id = req.body['dev_id'];
        var var_id = req.body['var_id'];

        var var_value = req.body['var_value'];


        //logger.info(req.hostname , req.url, req.protocol, req.ip);
        logger.info('gw_sn:', gw_sn);
        logger.info('devunit_id:', devunit_id, devunit_name);
        logger.info('var_id:', var_id, var_name, var_value);


        //支持批量任务下发
        var taskHandle = await MqttPubHandle.createTaskHandle(req.session.user_account, 'NA', '/'+ gw_sn);
        //执行固件升级命令
        var taskid = await MqttPubHandle.WTBL_CMD_SET.set_var_value(taskHandle, gw_sn, devunit_id, var_id, var_value);
        //res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: taskid});


        // 监听器, 更新任务结果，在updateResponse 中
        // 正常升级过程中没有回应消息，需要起定时器进行查询升级结果
        var listener = async function (gw_sn, josnObj) {
            logger.info('Hello listener:', josnObj);
            //timeout, 命令下发后，router进行升级，不回应该消息，timeout认为success
            if (gw_sn == -1 || josnObj == "timeout") {
                res.send({ret_code: -1, ret_msg: '执行超时', extra: taskid});
            }
            //成功的状态为0
            else if (josnObj['cmdId'] == 88 && josnObj['msg'] == 'success') {
                res.send({ret_code: 0, ret_msg: '成功', extra: josnObj});
                //更新数据库中的数值


                // 1. 更新到设备数据库，Gateway_Real_Table
                //更新到设备数据库
                let wherestr = {'devunit_name': devunit_name};
                let updatestr = {};
                let query = await DB.Gateway_Real_Table.findOne(wherestr).exec();
                if (query != null){
                    //复制数组，logs记录上下线日志
                    updatestr['data'] = query['data'];
                    for (var m = 0; m < updatestr['data'].length; m++){
                        if (updatestr['data'][m]['varName'] == var_name){
                            updatestr['data'][m]['varValue'] = var_value;
                        }
                    }
                    logger.info('update real table ok:', var_name, var_value);
                    await DB.Gateway_Real_Table.findByIdAndUpdate(query['_id'], updatestr).exec();
                }
                else{
                    logger.info('update real table fail,', var_name, var_value, query);
                }

            }
            else{
                res.send({ret_code: -1, ret_msg: '失败', extra: josnObj});
                return;
            }

        };
        //监听下发任务的结果, 超时5000ms
        //监听下发任务的结果

        await MqttSubHandle.addOnceListener(gw_sn, listener, 20000);
    }


}

const CmdProcHnd = new CmdProcHandle();
module.exports = CmdProcHnd;

