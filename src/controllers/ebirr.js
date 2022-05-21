const axios = require("axios").default;

const { Axios } = require("axios");
const { response } = require("express");
const MedaBills = require("../services/bills.service");

const waafipay = require("waafipay-sdk-node").API(
  "API-1901083745AHX",
  "1000297",
  "M0912269",
  { testMode: false }
); // TestMode flag -->  true is production : false is test


function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

var date = new Date();
var month = pad2(date.getMonth()+1);//months (0-11)
var day = pad2(date.getDate());//day (1-31)
var year= date.getFullYear();

var formattedDate = year+"-"+month+"-"+day;
//alert(formattedDate); 



module.exports.create = async (req, res) => {
  waafipay.preAuthorize(
    {
      paymentMethod: "MWALLET_ACCOUNT",
      accountNo: "252619977991",
      amount: "1",
      currency: "USD",
      description: "wan diray",
    },
    function (err, result) {
      if (err) {
        console.log("Error while creating: ", err);
        res.status(500).json({ error: "Unknown problem occured" });
      } else {
        console.log("success response response", result);
        res.json(result);
      }
    }
  );
};

module.exports.hppPurchase = async (req, res) => {
  const amount = req.body.amount;

  try {
    const result = await axios.post("https://testpayments.ebirr.com/asm", {
      schemaVersion: "1.0",
      requestId: "Rq" + Date.now().toString(),
      timestamp: Date.now().toString(),
      channelName: "WEB",
      serviceName: "HPP_PURCHASE",
      serviceParams: {
        storeId: "10000011",
        hppKey: "HPP-2030",
        merchantUid: "M1000004",
        hppSuccessCallbackUrl: "http://3.69.21.159:3000/api/callback",
        hppFailureCallbackUrl: "http://3.69.21.159:3000/api/callback",
        hppRespDataFormat: "4",
        paymentMethod: "MWALLET_ACCOUNT",
        payerInfo: {
          subscriptionId: 252615414470,
        },
        transactionInfo: {
          referenceId: "Rf" + Date.now().toString(),
          invoiceId: "In" + Date.now().toString(),
          amount: `${amount}`,
          currency: "ETB",
          description: "Hpp purchase",
        },
      },
    });

    console.log("Successfully created hpp purchase: ", result.data);
    res.status(result.status).json(result.data);
  } catch (error) {
    console.log("Error While creating hpp purchase: ", error);
    res.status(500).json({ error: "Unknown problem occured" });
  }
};

module.exports.getBillDetail = async (req, res) => {
  try {
    const theBill = await MedaBills.bill(req.params.referenceNumber, "");
    console.log("Successfully fetched details");
    res.status(200).json(theBill);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
};

module.exports.apiPurchase = async (req, res) => {
  // const amount = req.body.amount;
  const referenceNo = req.body.referenceNo;

  try {
    // Get the bill with the refrence number
    const theBill = await MedaBills.bill(referenceNo, "");
    console.log("Bill does exit", theBill.issuer, theBill.accountNumber);

    if ("metaData" in theBill && "ebirr_api_request" in theBill.metaData) {
      return res.status(409).json({
        error:
          "This bill transaction is complete please start a new transaction",
      });
      // return theBill.metaData.ebirr_hpp_request;
    }

    const apiRequestData = await axios.post(
      "https://testpayments.ebirr.com/asm",
      {
        schemaVersion: "1.0",
        requestId: "Rq-" + referenceNo,
        timestamp: Date.now(),
        channelName: "WEB",
        serviceName: "API_PURCHASE",
        serviceParams: {
          merchantUid: "M1040033",
          paymentMethod: "MWALLET_ACCOUNT",
          apiKey: "API-10618773",
          apiUserId: "10000008",
          payerInfo: {
            accountNo: theBill.accountNumber,
          },
          transactionInfo: {
            referenceId: "Rf-" + theBill.referenceNumber,
            invoiceId: "In-" + theBill.referenceNumber,
            amount: theBill.amount,
            currency: "ETB",
            description: theBill.description,
          },
        },
      }
    );
    console.log("made request");

    if (
      apiRequestData.data.responseMsg === "RCS_SUCCESS" &&
      apiRequestData.data.errorCode === "0" &&
      apiRequestData.data.params.state === "APPROVED"
    ) {
      console.log("Payment made successfully!");
      await MedaBills.addMetaData(
        theBill.referenceNumber,
        "ebirr_api_request",
        apiRequestData.data,
        ""
      );
      // console.log("Successfully created hpp purchase: ", result.data);
      await MedaBills.pay(
        theBill.referenceNumber,
        "",
        "ebirr",
        apiRequestData.data
      );

      const payedBill = await MedaBills.bill(theBill.referenceNumber, "");

      if ("purchaseDetails" in payedBill.metaData) {
        payedBill.purchaseDetails = payedBill.metaData.purchaseDetails;
      }

      delete payedBill.createdAt;
      delete payedBill.__v;
      delete payedBill.issuer;
      delete payedBill._id;
      delete payedBill.metaData;

      try {
        if (
          "redirectUrls" in theBill.metaData &&
          "callbackUrl" in theBill.metaData.redirectUrls &&
          isUrl(theBill.metaData.redirectUrls.callbackUrl)
        ) {
          const callbackResponse = await axios.post(
            theBill.metaData.redirectUrls.callbackUrl,
            payedBill
          );
          console.log(
            "Successfully called callback and replied with: ",
            callbackResponse.data
          );
        }
      } catch (err) {
        console.log(
          "Error trying to call the callback: ",
          theBill.metaData.redirectUrls.callbackUrl
        );
        console.log(err);
      }
      res.status(apiRequestData.status).json(payedBill);
    } else {
      console.log("Ooops!Could not complete payment", apiRequestData.data);
      res.status(500).json(apiRequestData.data);
    }
  } catch (error) {
    console.log("Error While creating api purchase: ", error);
    res.status(500).json({ error: "Unknown problem occured" });
  }
};







module.exports.callback = async (req, res) => {
  console.log("Callback called with: ", req.body);
  try{
 	
    const detail = await axios.get(
     // https://api.sandbox.pay.meda.chat    18.193.100.79
    `https://api.sandbox.pay.meda.chat/v1/bills/${req.body.referenceNumber}`,
    {
      headers: {
        authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdG9tZWRhQDM2MGdyb3VuZC5jb20iLCJuYW1lIjoiTWVkYSBWb3VjaGVyIiwicGhvbmUiOiIrMjUxOTEzMDA4NTk1IiwiaXNzIjoiIiwiaWF0IjoxNTk4OTY0NTQwLCJleHAiOjIwMzA1MDA1NDB9.p-QGfkmRtUlGTQhthS5PW1Ora6E4E-i5VMLjzAo96mY",
      },
    }
  ); 
  
 //https://jsonplaceholder.typicode.com/todos/1

if(req.body.metaData.purchaseDetails.type == 'Membership'){
 
 var get_member = await axios.get(`http://18.193.100.79:8001/api/resource/Members?fields=["name", "membership_expire_date"]&filters=[["Members","email","=","${req.body.metaData.purchaseDetails.orderId}"]]`,
  {
    headers: {
      'Authorization': 'token dee8ab57623961f:fff9a603eead917'
    },
  }
  );

  console.log('member', get_member.data)
}
else if(req.body.metaData.purchaseDetails.type == 'organizationMember'){
  var get_organization = await axios.get(`http://18.193.100.79:8001/api/resource/Organizations?fields=["name", "membership_expire_date"]&filters=[["Organizations","email","=","${req.body.metaData.purchaseDetails.orderId}"]]`,
  {
    headers: {
      'Authorization': 'token dee8ab57623961f:fff9a603eead917'
    },
  }
  );

  
  console.log('organization', get_organization.data)

}

  console.log('Payment updated ', detail)

  //console.log('helllooooo',get_member.data.data[0].name)

  if (detail.data.status) {
    
    console.log("The payment status is: ", detail.data.status);
   const result = await axios.put(`http://18.193.100.79:8001/api/resource/Payment/${req.body.referenceNumber}`,{
      payment_status: 'PAYED',
      payment_method: req.body.paymentMethod,
      //date: formattedDate,
      member_status:'Active',
      email:req.body.metaData.orderId
    },{
      headers: {
        'Authorization': 'token dee8ab57623961f:fff9a603eead917'
      }
    })
    console.log('Payment updated  ', result)

///////////////for the member
 /*
fetch(`http://localhost:8001/api/resource/Members?fields=["name", "membership_expire_date"]&filters=[["Members","email","=","${req.body.metaData.orderId}"]]`,{
	headers: {
      		'Authorization': 'token dee8ab57623961f:fff9a603eead917'
    	},

})
    .then(res => res.json())
    .then(json => {
        console.log("First",json );
    })*/
    if(req.body.metaData.purchaseDetails.type == 'Membership'){
      var dat = get_member.data.data[0].membership_expire_date
    }else if(req.body.metaData.purchaseDetails.type == 'organizationMember'){
      var dat = get_organization.data.data[0].membership_expire_date
    }

 

    let fd = formattedDate
    let myfd = fd[0].concat (fd[1],fd[2],fd[3]);
    let myfdm = fd[5].concat (fd[6]);
    let myfdd = fd[8].concat (fd[9]);

    if(dat == null ){

          let val = parseInt(myfd) +1;
          //new_date = val.concat("-",myfdm,"-",myfdd);
          new_date = val+"-"+myfdm+"-"+myfdd;

    }
    else{

///////
      let myInt = dat[0].concat (dat[1],dat[2],dat[3]);
      let myIntm = dat[5].concat (dat[6]);
      let myIntd = dat[8].concat (dat[9]);


        if(parseInt(myInt) < parseInt(myfd)){
          let val = parseInt(myfd) +1;
          //new_date = val.concat("-",myfdm,"-",myfdd);
          new_date = val+"-"+myfdm+"-"+myfdd;

        }

        else if(parseInt(myInt) == parseInt(myfd)){
          if(parseInt(myIntm) == parseInt(myfdm)){
            if(parseInt(myIntd) < parseInt(myfdd)){
              let val = parseInt(myfd) +1;
              //new_date = val.concat("-",myfdm,"-",myfdd);
              new_date = val+"-"+myfdm+"-"+myfdd;

            }else if (parseInt(myIntd) == parseInt(myfdd)){
              let val = parseInt(myfd) +1;
              //new_date = val.concat("-",myfdm,"-",myfdd);
              new_date = val+"-"+myfdm+"-"+myfdd;
            } else{
              let val = parseInt(myInt) +1;
              //new_date = val.concat("-",myIntm,"-",myIntd);
              new_date = val+"-"+myIntm+"-"+myIntd;
            }
          }else if (parseInt(myIntm) < parseInt(myfdm)){
            let val = parseInt(myfd) +1;
            //new_date = val.concat("-",myfdm,"-",myfdd);
            new_date = val+"-"+myfdm+"-"+myfdd;
          }else{
            let val = parseInt(myInt) +1;
            //new_date = val.concat("-",myIntm,"-",myIntd);
            new_date = val+"-"+myIntm+"-"+myIntd;
          }

        }else{
          let val = parseInt(myInt) +1;
          //new_date = val.concat("-",myIntm,"-",myIntd);
          new_date = val+"-"+myIntm+"-"+myIntd;
        }
  
    }





if(req.body.metaData.purchaseDetails.type == 'Membership'){
  const member_result = await axios.put(`http://18.193.100.79:8001/api/resource/Members/${get_member.data.data[0].name}`,{
     member_status: 'Active',
      membership_expire_date: new_date,
      membership_fee_amount: req.body.amount,
      generate_payment_reference: req.body.referenceNumber
    },{
      headers: {
        'Authorization': 'token dee8ab57623961f:fff9a603eead917'
      }
    })
    console.log('memberupdate ', member_result)
}
  


//http://localhost:8001/api/resource/Members/?filters=[["Members","email","=",${req.body.metaData.orderId}]]   fields=["name", "membership_expire_date"]&

  else if(req.body.metaData.purchaseDetails.type == 'organizationMember'){

    const org_result = await axios.put(`http://18.193.100.79:8001/api/resource/Organizations/${get_organization.data.data[0].name}`,{
      status: 'Active',
      membership_expire_date: new_date,
      membership_fee: req.body.amount,
      generate_payment_reference: req.body.referenceNumber
    },{
      headers: {
        'Authorization': 'token dee8ab57623961f:fff9a603eead917'
      }
    })
    console.log('orgupdate ', org_result)

  } 


    console.log("The payment status is: ", detail.data.status);
  }
  } catch (err) {
  	console.log('Error is', err)
  }
  return res.status(200).json({ success: "success" });
  
  // try {
  //   const data = req.body;
  //   console.log("Callback called with data::: ", req);
  //   console.log(res);
  //   await axios.post("http://localhost:4000/responses", {
  //     id: Math.floor(Math.random() + 1 * 1000),
  //     data: req,
  //   });
  //   const result2 = await axios.post("http://localhost:4000/requests", {
  //     id: Math.floor(Math.random() + 1 * 1000),
  //     data: res,
  //   });
  //   res.status(result2.status).send(result);
  // } catch (error) {
  //   await axios.post("http://localhost:4000/errors", {
  //     id: Math.floor(Math.random() + 1 * 1000),
  //     data: error,
  //   });
  //   console.log("Error on callback: ", error);
  //   res.status(500).send(error);
  // }
};


const isUrl = (string) => {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    console.log("is not url");
    return false;
  }
  console.log("is url");
  return url.protocol === "http:" || url.protocol === "https:";
};
