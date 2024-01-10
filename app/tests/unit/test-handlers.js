'use strict';

const app = require('../../app.js');
const eventsFunction = require('../../event');
const chai = require('chai');
const expect = chai.expect;

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
        const result = await eventsFunction.process(require('../../../events/pushEvent.json'))
        checkResult(result);
        let response = JSON.parse(result.body);
    });
});
