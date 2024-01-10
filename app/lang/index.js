const enGBLocale = require('./enGB')
const ptBRLocale = require('./ptBR')
const esCLLocale = require('./esCL')
const ptPTLocale = require('./ptPT')
const frFRLocale = require('./frFR')

module.exports = {
  'en-GB': {
    ...enGBLocale
  },
  'pt-BR': {
    ...ptBRLocale
  },
  'pt-PT': {
    ...ptPTLocale
  },
  'es-CL': {
    ...esCLLocale
  },
  'fr-FR': {
    ...frFRLocale
  }
}
