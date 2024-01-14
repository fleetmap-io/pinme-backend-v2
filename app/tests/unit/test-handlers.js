'use strict';

const app = require('../../app.js');
const eventsFunction = require('../../event');
const pinmeapi = require('../../pinmeapi');
const chai = require('chai');
const expect = chai.expect;
const email = require('../../email/email')
const fs = require("fs");
const path = require("path");
const cw = require('../../cloudwatch')

function checkResult(result) {
    console.log(result)
    expect(result).to.be.an('object');
    expect(result.statusCode).to.equal(200);
    expect(result.body).to.be.an('string');
}

describe('Tests index', function () {
    it('works on main-function', async () => {
        const result = await app.mainFunction(require('../../../events/event.json'))
        checkResult(result);
        let response = JSON.parse(result.body);
        expect(response).to.be.equal('');
    });

    it('works on push-events-function with ignitionoff', async () => {
        await eventsFunction.process(require('../../../events/pushEvent.json'))
    });

    it('works on pinemapi', async () => {
        const result = await pinmeapi.main(require('../../../events/pinmeapi.json'))
        checkResult(result);
    });

    it('sends emails', async () => {
        await email.email(['joaquim.cardeira@gmail.com'], ['wuizygo@gmail.com'], 'notification', 'teste notification', 'no-reply@gpsmanager.io')
        await email.emailWithAttachment(
            ['joaquim.cardeira@gmail.com'],
            ['admin@fleetmap.io'],
            'report',
            'teste report',
            'no-reply@gpsmanager.io',
            { // stream as an attachment
                filename: 'text4.txt',
                content: fs.createReadStream(path.join(__dirname, 'file.txt'))
            })
    });

    it('sends cloudwatch metrics', async () => {
        await cw.putMetrics({ resources: ['rule/everyMinute'] })
        await cw.putMetrics({ resources: ['rule/every5'] })
    })
});
