'use strict';

const DB = require('../../../models/models');
const BaseComponent = require('../../../prototype/baseComponent.js');
const crypto = require('crypto');
const dtime = require('time-formater');
const logger = require( '../../../logs/logs.js');



class Account extends BaseComponent {
	constructor() {
		super();
		this.login = this.login.bind(this);
        this.register = this.register.bind(this);
        this.dragregister = this.dragregister.bind(this);
		this.changePassword = this.changePassword.bind(this);
        this.deleteAccount = this.deleteAccount.bind(this);
		this.revoke = this.revoke.bind(this);
		this.restore = this.restore.bind(this);
		this.account_list = this.account_list.bind(this);
		this.logout = this.logout.bind(this);
	    //	this.updateAvatar = this.updateAvatar.bind(this);


		//本地调试, 设置管理员用户及密码
        //if (process.env.NODE_ENV == 'development') {
        this.addDefaultAccount('admin', '123456');
        this.addDefaultAccount('18211162033', '18211162033');
        //this.resetPassword('admin', '123456');
        logger.info('add default account')
        //}
	}

    Md5(password) {
        const md5 = crypto.createHash('md5')
        return md5.update(password).digest('hex')
    }

	async login(req, res, next){
	    logger.info('account login');
		let user_account = req.body.user_account;
		let user_password = req.body.user_password;


        try {
            if(!user_account) {
                throw new Error('账号名错误');
            }else if(!user_password){
                throw new Error('密码错误');
            }
        }catch(err){
            logger.info(err.message, err);
            res.send({ret_code: 1, ret_msg: err.message, extra: ''});
            return;
        }

		try {
			const query = await DB.AccountTable.findOne({user_account});
			if(!query) {
                logger.info('该用户不存在');
                res.send({ret_code: 1, ret_msg: '用户不存在', extra: ''});
                return;
            }
           
           
			if(user_password != query.user_password_md5) {
				logger.info('用户登录密码错误', query.user_password_md5);
				res.send({ret_code: 1, ret_msg: '密码错误', extra: ''});
				return;
			}

            if(query.user_status === 1){
                logger.info('用户被冻结');
                res.send({ret_code:1011, ret_msg: '你已经被冻结', extra: ''});
                return;
            }

            logger.info('登录成功');

            let updatestr = {
                'login_logs': [],
            };


            let mytime = new Date();
            //复制数组，logs记录上下线日志
            updatestr['login_logs'] = query['login_logs'].slice();
            updatestr['login_logs'].push(dtime(mytime).format('YYYY-MM-DD HH:mm:ss'));
            if (updatestr['login_logs'].length > 10){
                updatestr['login_logs'].shift();  //删除数组第一个元素
            }
            await DB.AccountTable.findByIdAndUpdate(query['_id'], updatestr).exec();

            // update session
            req.session.user_account = query.user_account;
            req.session.user_type = query.user_type;
            
            res.send({ret_code: 0, ret_msg: '欢迎你', extra: query.user_type});

		}catch(err) {
			logger.info('登录失败', err);
			res.send({ret_code: 1, ret_msg: '登录失败', extra: ''});
			return;
		}
	}


	async register(req, res, next){
		let user_account = req.body.user_account;
		let user_password = req.body.user_password;
        let user_region = req.body.user_region;
		let user_phone = req.body.user_phone;
        let user_city = req.body.user_city;
        let user_prov = req.body.user_prov;
        let user_belong = req.body.user_belong;
        let user_detail = req.body.user_detail;
        let user_type
        if(user_belong){
            user_type = 3;   //用户
        }else{
           user_type = 1;   //用户
        }
		
		let user_status = 0;
		try {
			if(!user_account) {
				throw new Error('账号名错误');
			}else if(!user_password){
				throw new Error('密码错误');
			}
		}catch(err){
			logger.info(err.message, err);
			res.send({ret_code: 1, ret_msg: '参数错误', extra: err.message});
			return;
		}


        let mytime = new Date();
        try{
            const admin = await DB.AccountTable.findOne({user_account});
            if(admin) {
                logger.info('用户已经存在');
                res.send({ret_code: 1, ret_msg: '用户已经存在', extra: ''});
                return;
            }

            //const newpassword = this.encryption(user_password);
            const newAdmin = {
                user_account: user_account,
                user_password: user_password,
                user_password_md5: this.Md5(user_password),
                user_region: user_region,
                user_phone: user_phone,
                user_create_time: dtime(mytime).format('YYYY-MM-DD HH:mm'),
                user_last_login_time: dtime(mytime).format('YYYY-MM-DD HH:mm'),
                user_type: user_type,
                user_status: user_status,
                user_belong: user_belong,
                user_detail:user_detail,
                user_city: user_city,
                user_prov: user_prov,

                user_device_count: 0,
                user_online_count: 0,
                login_logs:[]
            };

            await DB.AccountTable.create(newAdmin);
            res.send({ret_code: 0, ret_msg: '注册成功', extra: ''})

        }catch(err){
            logger.info('注册失败', err);
            res.send({ret_code: 1, ret_msg: '注册失败', extra: ''})
        }
	}

	async changePassword(req, res, next){
        logger.info('[website] account changePassword');
	//	let user_account = req.body.user_account;
		let user_account = req.body.user_account;
		let user_password = req.body.user_password;
		let user_new_password = req.body.user_new_password;
		try{
			if(!user_account){
				throw new Error('请登录用户账号');
			}else if(!user_password) {
				throw new Error('请输入用户密码');
			}
		}catch(err){
			logger.info(err.message, err);
			res.send({ret_code: 1,ret_msg: '参数错误',extra: err.message});
			return;
		}
		//const password = this.encryption(user_password);

		try{
            let wherestr = {'user_account': user_account};
			const admin = await DB.AccountTable.findOne(wherestr);
			if(!admin) {
                logger.info('用户不存在');
                res.send({ret_code: 1, ret_msg: '用户不存在', extra: ''});
                return;
            }
            if(user_password != admin.user_password) {
				logger.info('密码错误', user_password);
				res.send({ret_code: 1, ret_msg: '密码错误',extra: ''});
				return;
			}

            let updatestr = {
				'user_password': user_new_password,
                'user_password_md5': this.Md5(user_new_password),
			};

            await DB.AccountTable.findByIdAndUpdate(admin['_id'], updatestr);
            logger.info('修改密码成功');
            res.send({ret_code: 0, ret_msg: '修改密码成功',extra: ''});

		}catch(err){
			logger.info('修改用户密码失败');
			res.send({ret_code: 1, ret_msg: '修改用户密码失败',extra: ''});
			return;
		}
        logger.info('[website] account changePassword end');
	}

    async deleteAccount(req, res, next){
        logger.info('[website] account delete');
        //	let user_account = req.body.user_account;
        //获取表单数据，josn
        let user_account = req.body['user_account'];

        try{
            let wherestr = {'user_account': user_account};
            await DB.AccountTable.findOneAndRemove(wherestr);
            logger.info('删除账户成功');
            res.send({ret_code: 0,ret_msg: '删除账户成功',extra: ''});

        }catch(err){
            logger.info('删除账户失败');
            res.send({ret_code: 1,ret_msg: '删除账户失败',extra: ''});
        }
        logger.info('[website] account delete end');
    }

	async revoke(req, res, next){
        logger.info('[website] account revoke');
		try{
            let wherestr = {'user_account': req.body.user_account};
			const admin = await DB.AccountTable.findOne(wherestr);
			if(!admin){
				logger.info('用户不存在');
                res.send({ret_code: 1,ret_msg: '用户不存在',extra: ''});
                return;
			}

			if(admin.user_type === 0){
				logger.info('管理员不能冻结');
				res.send({ret_code: 1,ret_msg: '管理员不能冻结',extra:''});
				return;
			}

            let updatestr = {'user_status': 1};
            await DB.AccountTable.findByIdAndUpdate(admin['_id'], updatestr);
            res.send({ret_code: 0,ret_msg: '用户已冻结',extra: '',});
            logger.info('用户已冻结');
		}catch(err){
			logger.info('冻结用户失败', err);
			res.send({ret_code: 1,ret_msg: '冻结用户失败',extra: ''});
		}

        logger.info('[website] account revoke end');
	}

	async restore(req, res, next){
        logger.info('[website] account restore');
		try{
            let wherestr = {'user_account': req.body.user_account};
			const admin = await DB.AccountTable.findOne(wherestr);
			if(!admin){
				logger.info('用户不存在');
				res.send({ret_code: 1,ret_msg: '用户不存在',extra: ''});
				return;
			}

			if(admin.user_type === 0){
				logger.info('管理员不需要解冻');
				res.send({ret_code:1,ret_msg:'管理员不需要解冻',extra:''});
				return;
			}

            let updatestr = {'user_status': 0};
            await DB.AccountTable.findByIdAndUpdate(admin['_id'], updatestr);
            res.send({ret_code: 0,ret_msg: '用户已解冻',extra: ''});
            logger.info('用户已解冻');
		}catch(err){
			logger.info('解冻用户失败')
			res.send({ret_code: 1,ret_msg: '解冻用户失败',extra: ''})
		}

        logger.info('[website] account restore end');
	}
	async logout(req, res, next){
        logger.info('[website] account logout');
		try{
			delete req.session.user_account;
			delete req.session.user_type;
			res.send({ret_code: 0,ret_msg: '退出成功',extra: ''});
		}catch(err){
			logger.info('退出失败', err);
			res.send({ret_code: 1,ret_msg: '退出失败',extra: ''});
		}
        logger.info('[website] account end');
	}

	async account_list(req, res, next) {
        logger.info('[website] account list');
        //logger.info(req.body);

        //获取表单数据，josn
        let page_size = req.body['page_size'];
        let current_page = req.body['current_page'];
        let sort = req.body['sort'];
        let filter = req.body['filter'];
        let user_account = req.body['user_account'];

        // 如果没有定义排序规则，添加默认排序
        if(typeof(sort)==="undefined"){
            //logger.info('sort undefined');
            sort = {"sort_time":-1};
        }

        // 如果没有定义排序规则，添加默认排序
        if(typeof(filter)==="undefined"){
            //logger.info('filter undefined');
            filter = {
                user_type : {$ne:3}
            };
        }
        if(typeof(user_account)!="undefined"){
            filter = {
                user_account:user_account
            }
        }
        console.log(filter);   
        //logger.info('sort ', sort);
        //logger.info('filter ', filter);
        let total = await DB.AccountTable.count(filter).exec();

        //参数有效性检查
        if(typeof(page_size)==="undefined" && typeof(current_page)==="undefined"){
            let queryList = await DB.AccountTable.find(filter).sort(sort);
            //logger.info('queryList ', queryList);
            res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:queryList, total:total});
        }
        else if (page_size > 0 && current_page > 0) {
            let skipnum = (current_page - 1) * page_size;   //跳过数
            let queryList = await DB.AccountTable.find(filter).sort(sort).skip(skipnum).limit(page_size);
            //logger.info('queryList ', queryList);
            res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:queryList, total:total});
        }
        else{
            res.send({ret_code: 1002, ret_msg: 'json 参数无效', extra:req.body});
        }

        logger.info('[website] account list end');
	}

    async account_array(req, res, next) {
        logger.info('[website] account array');
        //logger.info(req.body);

        let queryList = await DB.AccountTable.find();
        let accountList = [];
        for (let i = 0; i < queryList.length; i++){
            accountList.push(queryList[i]['user_account']);
        }

        res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:accountList, total:queryList.length});
        logger.info('[website] account array end');
    }
    async getOwnProject(req, res, next) {
        logger.info('[website] account get own projects');

        //获取表单数据，josn
        let user_account = req.body['user_account'];

        //超级用户可以获取全部项目列表
        if(user_account == req.session.user_account && req.session.user_type == 0){
            let queryList = await DB.ProjectManageTable.find().exec();
            let prjList = [];
            for(let i= 0; i< queryList.length; i++){
                prjList.push(queryList[i]['project_name']);
            }
            res.send({ret_code: 0, ret_msg: '成功', extra: prjList});
        }
        //普通用户获取自己拥有的项目列表
        else {
            let wherestr = {'user_account': user_account};
            let query = await DB.AccountTable.findOne(wherestr).exec();
            logger.info('[website] get result:', query);
            if (query == null) {
                res.send({ret_code: 0, ret_msg: '成功', extra: []});
            }
            else {
                res.send({ret_code: 0, ret_msg: '成功', extra: query['user_projects']});
            }
        }
    }

    async updateOwnProject(req, res, next) {

        //获取表单数据，josn
        let user_projects = req.body['user_projects'];
        let user_account = req.body['user_account'];
        logger.info('[website] account update own projects', user_projects);

        let wherestr = {'user_account':user_account};
        let updatestr = {'user_projects': user_projects};
        await DB.AccountTable.findOneAndUpdate(wherestr, updatestr).exec();
        res.send({ret_code: 0, ret_msg: '成功', extra: user_projects});
    }

    async resetPassword(account, password){
        logger.info('[website] account resetPassword');
        //	let user_account = req.body.user_account;
        let user_account = account;
        let user_password = password;

        try{
            let wherestr = {'user_account': user_account};
            let updatestr = {
                'user_password': user_password,
                'user_password_md5': this.Md5(user_password),
            };

            await DB.AccountTable.findOneAndUpdate(wherestr, updatestr);
        }catch(err){
            logger.info('修改用户密码失败');
        }
        logger.info('[website] account resetPassword end');
    }
    async addDefaultAccount(user_account, user_password) {

        //await DB.AccountTable.findOneAndRemove({'user_account': user_account});
        try {
            let mytime = new Date();
            const admin = await DB.AccountTable.findOne({'user_account': user_account});
            if (admin == null) {
                const newAdmin = {
                    'user_account': user_account,
                    'user_password': user_password,
                    'user_password_md5': this.Md5(user_password),
                    'user_email':'chenzejun',
                    'user_phone':'18211162033',
                    'user_create_time': dtime(mytime).format('YYYY-MM-DD HH:mm'),
                    'user_last_login_time': dtime(mytime).format('YYYY-MM-DD HH:mm'),
                    'user_type':0,
                    'user_status':0,
                    'user_belong':'',
                    'user_detail':'',
                    'user_city':'beijing',
                    'user_device_count': 0,
                    'user_online_count': 0,
                    'login_logs':[]
                };
                await DB.AccountTable.create(newAdmin);
            }
        } catch (err) {
            logger.info('注册失败', err);
        }


    }
    async dragregister(req, res, next){
		let user_account = req.body.user_account;
		let user_password = req.body.user_password;
        let user_region = req.body.user_region;
		let user_phone = req.body.user_phone;
        let user_city = req.body.user_city;
        let user_prov = req.body.user_prov;
		let user_type = 3;   //用户
		let user_status = 0;
		try {
			if(!user_account) {
				throw new Error('账号名错误');
			}else if(!user_password){
				throw new Error('密码错误');
			}
		}catch(err){
			logger.info(err.message, err);
			res.send({ret_code: 1, ret_msg: '参数错误', extra: err.message});
			return;
		}


        let mytime = new Date();
        try{
            const admin = await DB.AccountTable.findOne({user_account});
            if(admin) {
                logger.info('用户已经存在');
                res.send({ret_code: 1, ret_msg: '用户已经存在', extra: ''});
                return;
            }

            //const newpassword = this.encryption(user_password);
            const newAdmin = {
                user_account: user_account,
                user_password: user_password,
                user_password_md5: this.Md5(user_password),
                user_region: user_region,
                user_phone: user_phone,
                user_create_time: dtime(mytime).format('YYYY-MM-DD HH:mm'),
                user_last_login_time: dtime(mytime).format('YYYY-MM-DD HH:mm'),
                user_type: user_type,
                user_status: user_status,

                user_city: user_city,
                user_prov: user_prov,

                user_device_count: 0,
                user_online_count: 0,
                login_logs:[]
            };

            await DB.AccountTable.create(newAdmin);
            res.send({ret_code: 0, ret_msg: '注册成功', extra: ''})

        }catch(err){
            logger.info('注册失败', err);
            res.send({ret_code: 1, ret_msg: '注册失败', extra: ''})
        }
	}

}

module.exports = new Account();

