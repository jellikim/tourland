const express = require('express');
const router = express.Router();
const sequelize = require("sequelize");
const Op = sequelize.Op;
const cookieParser = require("cookie-parser");
const bcrypt = require('bcrypt');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);

const models = require("../../models");
const fs = require('fs');
const querystring = require('querystring');
const crypto = require('crypto'); //μΆκ°λμ
const {getPagingData, getPagination} = require('../../controller/pagination');
const {makePassword, comparePassword} = require('../../controller/passwordCheckUtil');


router.get('/', async (req, res, next) => {

    const currentProductPrice = {};
    const currentProductPrice2 = {};
    const currentProduct ={};
    const currentProduct2 ={};

    const popup1 = await models.popup.findOne({
        raw: true,
        where : {
            position : "R"
        }
    });

    const startDate = new Date(popup1.enddate) - new Date(popup1.startdate);
    const endDate = Math.abs(startDate/(24*60*60*1000));

    // console.log("startdate->", startDate);
    // console.log("enddate->", endDate);

    const cookieConfig = {
        expires: new Date(Date.now() + endDate*24*60*60),
        path: '/',
        signed: true
    };
    res.cookie("popup1", popup1.pic, cookieConfig)

    const popup2 = await models.popup.findOne({
        raw: true,
        where : {
            position : "L"
        }
    });

    const startDate2 = new Date(popup2.enddate) - new Date(popup2.startdate);
    const endDate2 = Math.abs(startDate2/(24*60*60*1000));

    const cookieConfig2 = {
        expires: new Date(Date.now() + endDate2*24*60*60),
        path : '/',
        signed: true,
    };
    res.cookie("popup2", popup2.pic, cookieConfig2)


    const banner1 = await models.banner.findOne({
        raw: true,
        where : {
            position : "L"
        }
    });
    const banner2 = await models.banner.findOne({
        raw: true,
        where : {
            position : "R"
        }
    });

    let Auth = null;
    let login ="";

    let msg = `μΈμμ΄ μ‘΄μ¬νμ§ μμ΅λλ€.`
    if (req.session.user) {
        msg = `${req.session.user.User}`;
        Auth={username: req.session.user.User};
        login = req.session.user.login;
    }

    console.log("Auth->", Auth, msg);

    let Manager = {};
    let { searchType, keyword, keyword2} = req.query;
    let searchkeyword = keyword;


    res.render('tourlandMain', {
        currentProductPrice,
        currentProductPrice2,
        currentProduct,
        currentProduct2,
        popup1:popup1,
        popup2,
        banner1,
        banner2,
        Auth,
        login,
        Manager,
        searchkeyword
    });

});


router.get('/tourlandRegister', function (req, res, next) {

    let autoNo = "";

    let userVO = {};


    let Auth = null;
    let login ="";

    let msg = `μΈμμ΄ μ‘΄μ¬νμ§ μμ΅λλ€.`
    if (req.session.user) {
        msg = `${req.session.user.User}`;
        Auth={username: req.session.user.User};
        login = req.session.user.login;
    }

    console.log("Auth->", Auth, msg);

    let Manager = {};
    let { searchType, keyword, keyword2} = req.query;
    let searchkeyword = keyword;


    res.render("user/tourlandRegisterForm",  {autoNo, Auth,login, Manager, searchkeyword,userVO});
});

router.post('/tourlandRegister', async (req,res,next)=> {
    let query;
    console.log("register->", req.body);

    // Check if the email is already in use
    let userExists = await models.user.findOne({
        raw: true,
        where : {
            userid: req.body.userid
        }
    });

    if (userExists) {
        res.status(401).json({ message: "Email is already in use." });
        return;
    }

    // Define salt rounds
    const saltRounds = 10;
    // Hash password
    bcrypt.hash(req.body.userpass, saltRounds, (err, hash) => {
        if (err) throw new Error("Internal Server Error");

        req.body.userpass = hash;

        const user = models.user.create(req.body);
        query = querystring.stringify({
            "registerSuccess": true,
            "id": user.userid
        });
        res.redirect('/customer/loginForm/?'+query);
    });

});


router.get('/idCheck/:userid', async (req,res,next)=> {

    const userid = req.params.userid;

    try{
        let checkUserid = await models.user.findOne({
            raw: true,
            attributes : ['userid'],
            where : {
                userid : userid
            }
        })

        if( checkUserid != null)
        {
            console.log("check->", checkUserid.userid);
            if( checkUserid.userid != null) {
                res.status(200).send("exist");
            }
        }
        else{
            res.status(200).send("notexist");
        }
    }
    catch (e){
        console.error(e);
        next(e);
    }

});



router.get('/loginForm', async (req,res,next)=> {
    let { registerSuccess, id} = req.query;

    let UserStay = {userid:id};

    let EmpStay = {};
    let error = "";
    let Auth ={};
    let login ="";
    let Manager = {};
    let searchkeyword = "";


    res.render("user/tourlandLoginForm", {Auth,login, Manager,searchkeyword, registerSuccess, UserStay, EmpStay, error});
});


const fecthData = async (req) => {
    let { id, pass} = req.body;
    let error = "";

    if(id == null){
        error= 'idempty';
    }
    if(pass == null){
        error= 'passempty';
    }

    let userVO;
    try {
        if( id !== null && pass !=null) {
            // ID,PASSκ° μλ ₯λ κ²½μ°
            userVO = await models.user.findOne({
                raw: true,
                // attributes: ['userid', 'userpass','usersecess'],
                where: {
                    userid: id
                }
            })
        }

    }catch (e){
        console.log(e);
    }

    return userVO;

}


router.post('/loginForm', (req,res,next)=> {
    let { id, pass} = req.body;

    let empVO ={};
    let session = {};

    let registerSuccess = {};
    let UserStay;
    let EmpStay = {};
    let error = "";
    let Auth ={};
    let login ="";
    let Manager = {};
    let searchkeyword = "";
    let loginSuccess = false;

    fecthData(req).then((userVO)=>{

        // μ§μ IDκ° μλ κ²½μ°
        if(userVO.userid == null){
            error = "idnoneexist";
        }else{

            // μ§μ IDκ° μκ³  νν΄ν νμ
            if(userVO.usersecess === 1){
                error = "retiredcustomer";
            }else if(userVO.usersecess === 0){
                bcrypt.compare(req.body.pass, userVO.userpass, (err, result) => {
                    console.log("comparePassword2222->",result);
                    UserStay = userVO;
                    if (result) {
                        loginSuccess = true;

                        if(req.session.user){
                            console.log(`μΈμμ΄ μ΄λ―Έ μ‘΄μ¬ν©λλ€.`);
                        }else{
                            req.session.user = {
                                "User" : userVO.username,
                                "id" : id,
                                "login" : "user",
                                "Auth" : userVO.userpass,
                                "pass" : pass,
                                "mypage" : "mypageuser",
                            }
                            console.log(`μΈμ μ μ₯ μλ£! `);
                        }
                        res.redirect('/customer');
                    }
                    else{
                        console.log("comparePassword4444->",result);
                        error = "passnotequal";
                        res.render("user/tourlandLoginForm", {Auth,login, Manager,searchkeyword, registerSuccess, UserStay, EmpStay, error});

                    }
                })

            }
            else{
                error = "usernotfind";
            }

        }

    })

});


router.get("/logout", (req, res, next)=>{

    req.session.destroy();
    console.log(`sessionμ μ­μ νμμ΅λλ€.`);
    res.redirect("/customer");
})





module.exports = router;

