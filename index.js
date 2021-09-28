const express = require('express')
const fs = require('fs')
const { exec } = require('node-exec-promise');
const app = express()
const port = 3000

const folderPath = 'site-config/'

const execPromise = (command) => new Promise((resolve, reject) => {
    try {
        return exec(command).then((out) => {
            resolve(out.stdout);
        }, (err) => {
            console.error(err);
            return reject(err);
        });
    } catch (err) {
        return reject(err);
    }
});

const throwError = (code = 500, errorType, errorMessage) => {
    const error = new Error(errorMessage || errorType);
    error.code = code;
    error.errorType = errorType;
    throw error;
};

app.get('/', (req, res) => {
    res.end('Hello World!');
});

const sampleJson = async (domainName) => {
     try{
         const fileName = `${folderPath}/${domainName}.json`;
         const json =  {
             "Comment": "CREATE/DELETE/UPSERT a record ",
             "Changes": [{
                 "Action": "CREATE",
                 "ResourceRecordSet": {
                     "Name": `www.${domainName}`,
                     "Type": "A",
                     "TTL": 300,
                     "ResourceRecords": [{ "Value": "18.191.177.70"}]
                 }}]
         }

         await fs.writeFileSync(fileName, JSON.stringify(json), 'utf8');
         return fileName
     } catch (e) {
         console.log("Error", e)
         return throwError(500, e)
     }

}

const readAndReplace = (fileName, find, replace) => new Promise((resolve, reject) => {
    return fs.readFile(fileName, 'utf8', function (err,data) {
        if (err) {
            return reject(err);
        }
        var result = data.replace(new RegExp(find, 'g'), replace);

        return fs.writeFile(fileName, result, 'utf8', function (err) {
            if (err) {
                return reject(err);
            }
            return resolve(result)
        });
    });
})
const createVhost = async (domainName) => {
    try{
        const fileName = `${folderPath}/${domainName}.conf`;
        const sslFileName = `${folderPath}/${domainName}-le-ssl.conf`;

        await execPromise(`cp 000-default.conf ${fileName}`);
        await execPromise(`cp 000-default-le-ssl.conf ${sslFileName}`);
        await readAndReplace(fileName, 'DOMAINNAME', domainName);
        await readAndReplace(sslFileName, 'DOMAINNAME', domainName);

        await execPromise(`cp -r *.conf /etc/apache2/sites-enabled/`);
        await execPromise(`sudo service apache2 reload`);
        return fileName
    } catch (e) {
        console.log("Error", e)
        return throwError(500, e)
    }
}


app.post('/', async (req, res) => {
    const {domain} = req.body;

    if(!domain){
        return res.status(404).json({ msg: 'user not found' });
    }

    const fileName = await sampleJson(domain);

    await execPromise(`aws route53 change-resource-record-sets --hosted-zone-id Z03350163HDJLOQU176N7 --change-batch file://${fileName}`)

    await createVhost(domain);

    res.end('Hello World!');

});

app.listen(port, () => {
    console.log(`app listening at http://localhost:${port}`)
});
