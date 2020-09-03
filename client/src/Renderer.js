import React, { useState } from 'react';
import axios from 'axios';
import VendorCard from './components/VendorCard';

export default () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [vendors, setVendors] = useState({ vendors: [] });
  const [download, setDownload] = useState(false);
  const [generalCSV, setGeneralCSV] = useState(null);

  function getFile(e) {
    setSelectedFile(e.target.files[0]);
  }

  function parseCSVFile(csv) {
    const lines = csv.split('\n');

    const result = [];

    const headers = lines[0].split(',');

    for (var i = 1; i < lines.length; i++) {
      const obj = {};

      let currentline = lines[i].split(',');

      if (currentline.length === headers.length) {
        for (var j = 0; j < headers.length; j++) {
          obj[headers[j]] = currentline[j];
        }
        result.push(obj);
      } else if ((currentline.length > 45) & (currentline.length < headers.length)) {
        for (var k = 0; k < headers.length; k++) {
          obj[headers[k]] = currentline[k];
        }
        i++;
        currentline = lines[i].split(',');

        while (currentline.length < 24) {
          if (currentline.length === 23) {
            obj.Vendor = currentline[5];
            break;
          }
          i++;
          currentline = lines[i].split(',');
        }
        result.push(obj);
      }
    }
    return result; //JavaScript object
    // return JSON.stringify(result); //JSON
  }

  function sanitiseData(data) {
    return data.map((p) => {
      return {
        name: p['Lineitem name'],
        price: Number(p['Lineitem price']),
        quantity: Number(p['Lineitem quantity']),
        fulfillDate: p['Fulfilled at'],
        orderDate: p['Created at'],
        paidDate: p['Paid at'],
        orderNr: p.Name,
        vendor: p.Vendor,
        itemFulfillment: p['Lineitem fulfillment status'],
        fulfillment: p['Fulfillment Status'],
        shipping: p.Shipping,
      };
    });
  }

  function filterAndGroupVendors(clearData) {
    let vendors = {};
    let shippingFees = {
      name: 'Shipping',
      grossSale: 0,
      rood15: 0,
      amountToBePaid: 0,
      soldItems: [],
    };
    let fulfilledAt = null;

    clearData.forEach((e) => {
      const order = e.orderNr;
      const vendorModal = {
        name: e.vendor,
        soldItems: [],
        itemCount: 0,
        grossSale: 0,
        amountToBePaid: 0,
        rood15: 0,
      };
      if (e.fulfillment === 'fulfilled' && e.shipping !== '0') {
        shippingFees.soldItems.push({
          orderNr: order,
          price: Number(e.shipping),
          quantity: 1,
          orderPlacedAt: e.orderDate,
        });
      }
      if (e.itemFulfillment === 'fulfilled') {
        if (e.fulfillment) {
          fulfilledAt = e.fulfillDate;
        }

        if (e.vendor) {
          if (!vendors[e.vendor]) {
            if (e.vendor === 'Tip Jar') {
              vendors[e.vendor] = { ...vendorModal, name: 'Same Day Delivery' };
            } else {
              vendors[e.vendor] = vendorModal;
            }
          }
          vendors[e.vendor].soldItems.push({
            name: e.name.replace('@#@', '-'),
            price: e.price,
            quantity: e.quantity,
            orderNr: e.orderNr,
            orderPlacedAt: getFormattedDate(e.orderDate),
            orderFulfilledAt: getFormattedDate(fulfilledAt),
          });
        }
      } else if (e.name === 'Tip') {
        if (!vendors.Tip) {
          vendors.Tip = { ...vendorModal, name: 'Tip' };
        }
        vendors.Tip.soldItems.push({
          name: e.name.replace('@#@', '-'),
          price: e.price,
          quantity: e.quantity,
          orderNr: e.orderNr,
          orderPlacedAt: getFormattedDate(e.orderDate),
        });
      }
    });
    vendors.Shipping = shippingFees;
    return vendors;
  }

  function getFormattedDate(fullDate) {
    var date = new Date(fullDate);
    var dd = date.getDate();

    var mm = date.getMonth() + 1;
    var yyyy = date.getFullYear();
    if (dd < 10) {
      dd = '0' + dd;
    }

    if (mm < 10) {
      mm = '0' + mm;
    }

    date = mm + '/' + dd + '/' + yyyy;
    return date;
  }

  function takePercentage(amount, percentage) {
    return Number(((amount / 100) * percentage).toFixed(2));
  }
  function roundNumber(num) {
    return Number(num.toFixed(2));
  }

  function calculateTotals(vendors) {
    let totalGross = 0;
    let totalToPay = 0;
    let totalRood15 = 0;
    for (let vendor in vendors) {
      let totalSold = 0;

      vendors[vendor].soldItems.forEach((i) => {
        let amount = i.price * i.quantity;
        vendors[vendor].itemCount += i.quantity;
        totalSold += amount;
        vendors[vendor].grossSale += amount;
        if (
          vendor !== 'Tip Jar' &&
          vendor !== 'Tip' &&
          getFormattedDate(i.orderPlacedAt) < getFormattedDate('2020-06-08 00:00:01 +0200')
        ) {
          let rood15 = takePercentage(amount, 15);
          i.rood15 = rood15;
          vendors[vendor].amountToBePaid += amount - rood15;
          vendors[vendor].rood15 += rood15;
        } else {
          vendors[vendor].amountToBePaid += amount;
        }
      });
      vendors[vendor].grossSale = roundNumber(vendors[vendor].grossSale);
      vendors[vendor].amountToBePaid = roundNumber(vendors[vendor].amountToBePaid);
      vendors[vendor].rood15 = roundNumber(vendors[vendor].rood15);
      vendors[vendor].soldItems.push({
        name: 'TOTAL',
        price: roundNumber(totalSold),
        rood15: vendors[vendor].rood15,
      });

      if (vendor !== 'Tip Jar') {
        totalToPay += vendors[vendor].amountToBePaid;
      }
      totalGross += vendors[vendor].grossSale;
      totalRood15 += vendors[vendor].rood15;
    }
    vendors.totalGross = roundNumber(totalGross);

    vendors.totalToPay = roundNumber(totalToPay);
    vendors.totalRood15 = roundNumber(totalRood15);

    return vendors;
  }

  async function getCsvFile(dataArray, name) {
    const res = await axios.post('https://shopify-order-export-renderer.herokuapp.com/upload', {
      dataArray,
      name,
    });
    if (res.data === 'it is ok') {
      setDownload({ name, url: `https://shopify-order-export-renderer.herokuapp.com/${name}.csv` });
    }
  }

  async function getGeneralCsvFile(dataArray) {
    let name;
    let startDate = getFormattedDate(dataArray[0].soldItems[0].orderPlacedAt);
    let endDate = getFormattedDate(dataArray[0].soldItems[0].orderPlacedAt);
    const newArr = dataArray.map((vendor) => {
      if (vendor.soldItems && vendor.name !== 'Tip Jar') {
        vendor.soldItems.forEach((item) => {
          if (item.quantity) {
            if (getFormattedDate(item.orderPlacedAt) > endDate) {
              endDate = getFormattedDate(item.orderPlacedAt);
            } else if (getFormattedDate(item.orderPlacedAt) < startDate) {
              startDate = getFormattedDate(item.orderPlacedAt);
            }
          }
        });

        name = `${startDate.replace(/\//g, '')}-${endDate.replace(/\//g, '')}generalCSV`;
        return {
          name: vendor.name,
          period: `${startDate}-${endDate}`,
          'Total Quantity': vendor.itemCount,
          'Gross Sale': vendor.grossSale,
          Payout: vendor.amountToBePaid,
          Roodkappje: vendor.rood15,
        };
      } else {
        console.log('this is a problem with general csv preparing function');
        return null;
      }
    });
    setGeneralCSV(name);

    getCsvFile(newArr, name);
  }

  function onShowClick() {
    if (selectedFile) {
      let fileReader = new FileReader();
      fileReader.readAsBinaryString(selectedFile);

      fileReader.onload = (e) => {
        let data = e.target.result;

        const dataObjType = parseCSVFile(data);

        const clearData = sanitiseData(dataObjType);
        let vendors = filterAndGroupVendors(clearData);
        vendors = calculateTotals(vendors);
        const vendorsArr = [];
        for (let i in vendors) {
          if (i !== 'totalGross' && i !== 'totalToPay' && i !== 'totalRood15') {
            vendorsArr.push(vendors[i]);
          }
        }

        vendors = {
          vendors: vendorsArr,
          totalGross: vendors.totalGross,
          totalToPay: vendors.totalToPay,
          totalRood15: vendors.totalRood15,
        };
        setVendors(vendors);
      };
    }
  }

  return (
    <div className='dropField'>
      <div className='upload-section'>
        <h4>Upload orders CSV</h4>
        <div className='upload-input'>
          <input type='file' accept='.csv' id='fileInput' onChange={getFile} />
          <button onClick={onShowClick}>Show Results</button>
          {vendors.vendors[0] &&
            (download.name !== generalCSV ? (
              <button onClick={() => getGeneralCsvFile(vendors.vendors)}>
                Prepare Vendors CSV
              </button>
            ) : (
              <a href={download.url}>Download Csv</a>
            ))}
        </div>
      </div>
      <div className='vendor-card-container'>
        {vendors.vendors[0] &&
          vendors.vendors.map((v) => (
            <VendorCard key={v.name} v={v} getCsvFile={getCsvFile} download={download} />
          ))}
      </div>
    </div>
  );
};
