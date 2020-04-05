if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
}

const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  newPipeline
} = require('@azure/storage-blob');

const express = require('express');
const router = express.Router();
const containerName = 'file';
const multer = require('multer');
const inMemoryStorage = multer.memoryStorage();
const uploadStrategy = multer({ storage: inMemoryStorage }).array('image',4);

const getStream = require('into-stream');




const sharedKeyCredential = new StorageSharedKeyCredential(
  process.env.AZURE_STORAGE_ACCOUNT_NAME,
  process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY);
const pipeline = newPipeline(sharedKeyCredential);

const blobServiceClient = new BlobServiceClient(
  `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
  pipeline
);

const getBlobName = originalName => {
  const identifier = Math.random().toString().replace(/0\./, '');
  return `${identifier}-${originalName}`;
};

router.get('/', async (req, res, next) => {

  let viewData;

  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const listBlobsResponse = await containerClient.listBlobFlatSegment();
    

    for await (const blob of listBlobsResponse.segment.blobItems) {
      var myJSON = JSON.stringify(blob);
      console.log(`Blob: ${myJSON}`);
      console.log(`Blob------: ${blob.properties.lastModified}`);
    }

    viewData = {
      title: 'Home',
      viewName: 'index',
      accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
      containerName: containerName
    };

    if (listBlobsResponse.segment.blobItems.length) {
      viewData.thumbnails = listBlobsResponse.segment.blobItems;
    }
  } catch (err) {
    viewData = {
      title: 'Error',
      viewName: 'error',
      message: 'There was an error contacting the blob storage container.',
      error: err
    };
    res.status(500);
  } finally {
    res.render(viewData.viewName, viewData);
  }
});

router.post('/', uploadStrategy, async (req, res) => {
  if (req != null && req.files != null && req.files.length > 0) {
    for (var i = 0; i < req.files.length; i++) {
      var blobName = getBlobName(req.files[i].originalname);
      var stream = getStream(req.files[i].buffer);
      var containerClient = blobServiceClient.getContainerClient(containerName);;
      var blockBlobClient = containerClient.getBlockBlobClient(blobName);
      try {
        await blockBlobClient.uploadStream(stream);
        if (i === req.files.length -1) {
          res.render('success', { message: 'File uploaded to Azure Blob storage.' });
        }
      } catch (err) {
        res.render('error', { message: err.message });
      }
    }
  }
});

module.exports = router;