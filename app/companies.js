const mysql = require('./mysql')
const reader = require('./mysql')

exports.get = async (user) => {
  const select = 'select c.id, c.creationdate, c.clientnumber, c.name, c.taxnumber, c.notes, d.totaldevices, d2.totaldevicesconfigured, companyUser.email '

  const from = `from traccar.bo_company c 
        join traccar.tc_users user on c.partnerid = user.partnerid and user.email = '${user}'
        left join (SELECT attributes->>'$.companyId' AS companyId, email
                     FROM traccar.tc_users
                 GROUP BY attributes->>'$.companyId') companyUser on c.id = companyUser.companyId
        left join (select td.attributes->>'$.clientId' client, count(*) totaldevices        
            from traccar.tc_devices td 
            where td.disabled=0 and td.partnerid=(select u.partnerid from traccar.tc_users u where u.email = '${user}')
            GROUP by client) d on d.client = c.id
        left join (select td.attributes->>'$.clientId' client, count(*) totaldevicesconfigured
            from traccar.tc_devices td 
            left join traccar.tc_positions_last p on p.deviceid = td.id
            where (positionid is not null and p.attributes->>'$.source' is null) and td.disabled=0 
            and td.partnerid=(select u.partnerid from traccar.tc_users u where u.email = '${user}')
            GROUP by client) d2 on d2.client = c.id
        group by c.id
        `

  const orderBy = 'order by c.name'

  const querySelect = `${select} ${from} ${orderBy}`
  console.log(querySelect)
  const [result] = await reader.query(querySelect, process.env.DB_HOST_READER)
  console.log('returning', result.length)
  return result
}

exports.put = async (newCompany, user) => {
  console.log('add company')
  const query2 = `
            insert into traccar.bo_company (name, taxnumber, clientnumber, notes, partnerid) values ('${newCompany.name}','${newCompany.taxnumber}','${newCompany.clientnumber}','${newCompany.notes}',(select partnerid from traccar.tc_users where email = '${user}'))
        `
  console.log(query2)
  console.log(await mysql.query(query2))

  return { body: 'ok' }
}

exports.post = async (company, user) => {
  console.log('edit company')

  const taxnumber = company.taxnumber ? company.taxnumber : ''
  const clientnumber = company.clientnumber ? company.clientnumber : ''

  const query2 = `
            update traccar.bo_company set name='${company.name}',taxnumber='${taxnumber}',clientnumber='${clientnumber}',notes='${company.notes}'
            where id='${company.id}' and partnerid=(select partnerid from traccar.tc_users where email='${user}')
        `
  console.log(query2)
  console.log(await mysql.query(query2))

  return { body: 'ok' }
}

exports.delete = async (companyId, user) => {
  console.log('delete company', companyId)
  const query = `delete from traccar.bo_company where id=${companyId} and partnerid=(select partnerid from traccar.tc_users where email='${user}')`
  console.log(query)
  console.log(await mysql.query(query))
  return { body: 'ok' }
}
