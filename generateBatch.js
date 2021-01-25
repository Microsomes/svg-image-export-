const puppeteer = require('puppeteer');
const fs = require("fs");
var http = require('https');
var Jimp = require('jimp');


async function finalProcessImage({
    path,
    generatedPNGID
}){
    return new Promise((resolve,reject)=>{
        Jimp.read(path, (err, img) => {
            if (err) {
                reject(err);
            }
            img
            .resize(3544, 6939) // resize
            .write("tmp/02d_batch_resized"+generatedPNGID+".png"); // save
            console.log("resize done")
            resolve("tmp/02d_batch_resized"+generatedPNGID+".png")
        });

    })
}
async function downloadAsset({
    url,
    path,
    name
}){
    return new Promise(async (resolve,reject)=>{
        var download = function(url, dest, cb) {
            var file = fs.createWriteStream(dest);
            var request = http.get(url, function(response) {
              response.pipe(file);
              file.on('finish', function() {
                file.close(cb);  // close() is async, call cb after close completes.
              });
            }).on('error', function(err) { // Handle errors
              fs.unlink(dest); // Delete the file async. (But we don't check the result)
              if (cb) cb(err.message);
            });
          };
          download(url,path,(done)=>{
            resolve("done");
          })
    })
}

async function generateBatch({
    svgTemplate,
    imagePathsArr
}) {
    return new Promise(async (resolve, reject) => {
        //downloads the template svg
        const svgID= Math.random()
        console.log("downloading svg template")
        await downloadAsset({
            url:svgTemplate,
            path:"tmp/"+svgID+".svg",
            name:svgID
        });
        console.log("downloaded svg template")

        //loads the svg we just downloaded needed for later
        const svgTemplateString= fs.readFileSync("./tmp/"+svgID+".svg").toString();

        //lets download all the image assets too now

        var allAssetIDs=[]
        console.log("downloading assets now")
        for(var i=0;i<imagePathsArr.length;i++){
            var assetID= Date.now()
            await downloadAsset({
                url:imagePathsArr[i],
                path:"tmp/"+assetID+".png",
                name:assetID
            })
            console.log("downloaded:"+i)
            allAssetIDs.push(assetID);
        }
        
        const browser = await puppeteer.launch({
            headless: true
        });

        const page = await browser.newPage();
        await page.setViewport({
            deviceScaleFactor: 10,
            height: 1000,
            width: 500
        })

        await page.goto("https://design.bakerdays.devdomain.io/cakeEditor#/generate?generate=t")

        await page.evaluate((svgT) => {
            document.querySelector("#svgContainer2").innerHTML = svgT;
        }, svgTemplateString)

        await page.waitForTimeout(1000);
        const generatedPNGID = Math.random();
        var element = await page.$('#svgContainer2'); // declare a variable with an ElementHandle
        await element.screenshot({
            path: "tmp/02d_batch" + generatedPNGID + '.png',
        });
        await page.waitForTimeout(1000)
        
        console.log("resizing output")
       var finalImage= await finalProcessImage({
           path:"tmp/02d_batch"+generatedPNGID+".png",
           generatedPNGID:generatedPNGID
       })

       await page.waitForTimeout(100);

        
       resolve("tmp/02d_batch_resized"+generatedPNGID+".png")
        await browser.close();
    })
}




generateBatch({
    svgTemplate:"https://dev-3.bakerdays.devdomain.io/pub/media/personalisation/batches/000000019_000000024_000000025_000000026_000000027_000000037_letterbox/small.svg",
    imagePathsArr:[
        "https://dev-3.bakerdays.devdomain.io/pub/media/personalisation/orders/000000161/1612_high_res.png",
        "https://dev-3.bakerdays.devdomain.io/pub/media/personalisation/orders/000000161/1612_high_res.png",
        "https://dev-3.bakerdays.devdomain.io/pub/media/personalisation/orders/000000161/1612_high_res.png",
        "https://dev-3.bakerdays.devdomain.io/pub/media/personalisation/orders/000000161/1612_high_res.png"

    ]
}).then(batch=>{
    var bitmap = fs.readFileSync(batch);

    // Remove the non-standard characters
    var tmp  = bitmap.toString().replace(/[“”‘’]/g,'');

    // Create a buffer from the string and return the results
    var b64=new Buffer(tmp).toString('base64');

    fs.writeFileSync("res.txt","data:image/png;base64,"+b64,(err)=>{})

    
}).catch(err=>{
    console.log("error")
})