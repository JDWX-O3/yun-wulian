'use strict';

const express = require('express');
const CtlDeviceManage = require('../controller/manage/ctl_devunit_mange.js');
const router = express.Router();

console.log("enter route of devunit");


router.all('/list',  CtlDeviceManage.device_list);
router.all('/listv',  CtlDeviceManage.device_listv);
router.all('/page/list',  CtlDeviceManage.device_page_list);
router.all('/add',  CtlDeviceManage.device_add);
router.all('/array',  CtlDeviceManage.device_array);

router.all('/del',  CtlDeviceManage.device_del);
router.all('/update',  CtlDeviceManage.device_update);
router.all('/export/history',  CtlDeviceManage.export_data);
//router.all('/hide',  CtlDeviceManage.project_hide);
//router.all('/resume',  CtlDeviceManage.project_resume);


module.exports = router;
