const { expect } = require('chai')
const db = require('db')
const buildRoutes = require('server/routes')
const buildMockRouter = require('../buildMockRouter')
const FileRepository = require('db/repositories/fileRepository')

describe('routes', function () {
  let router, route, res, req, inputFile, totalSeedTestFiles

  const testBaseFileName = 'bobby-tables'
  const testFileExtension = 'jpg'
  const username = 'testuser'
  const fileRepository = new FileRepository(db.instance)

  function buildUploadData ({
    baseFileName=null,
    fileExt=null,
    base64=null,
    mimetype=null,
  }) {
    return {
      description: 'A portait of an artist',
      file: {
        name: `${baseFileName || testBaseFileName}.${fileExt || testFileExtension}`,
        mimetype: mimetype || 'image/jpg',
        base64: base64 || 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
      },
    }
  }

  function validateTest ({ inputFile, expectedFilename, responseBody }) {
    expect(responseBody.id).to.be.ok
    expect(responseBody.description).to.equal(inputFile.description)
    expect(responseBody.filename).to.equal(expectedFilename)
    expect(responseBody.mimetype).to.equal(inputFile.file.mimetype)
    expect(responseBody.src).to.equal(inputFile.file.base64)
  }

  beforeEach(async function () {
    req = {
      username,
    }
    res = {
      send: (value) => { res.body = value },
    }
    router = buildRoutes(buildMockRouter())
  })

  describe('GET /api/files', function () {
    beforeEach(async function () {
      route = '/api/files'
      totalSeedTestFiles = fileRepository.getTotal()
    })

    it('returns all the files', async function () {
      await router.getRoutes[route](req, res)
      expect(res.body).to.have.length(totalSeedTestFiles)
    })

    it('returns 0 files for user with no uploads', async function () {
      req.username = 'test1'
      await router.getRoutes[route](req, res)
      expect(res.body).to.have.length(0)
    })
  })

  describe('POST /api/files', function () {
    beforeEach(async function () {
      route = '/api/files'
      inputFile = buildUploadData({})
      db.resetToSeed()
    })

    it('uploads a file and returns its metadata', async function () {
      req.body = inputFile
      await router.postRoutes[route](req, res)

      validateTest({
        inputFile,
        expectedFilename: inputFile.file.name,
        responseBody: res.body,
      })
    })

    it('users uploads a file, same filename as file uploaded by different user', async function () {
      const username2 = 'testuser2'
      fileRepository.insertFile({
        description: inputFile.description,
        filename: inputFile.file.name,
        mimetype: inputFile.file.mimetype,
        src: inputFile.file.base64,
        username: username2,
      })
      const totalRecords = fileRepository.getTotal()
      expect(totalRecords).to.equal(totalSeedTestFiles + 1)

      const input = buildUploadData({})
      req.body = input
      await router.postRoutes[route](req, res)
      
      validateTest({
        inputFile,
        expectedFilename:input.file.name,
        responseBody: res.body,
      })
    })

    it('uploads 1st duplicate, original exists in db', async function () {
      fileRepository.insertFile({
        description: inputFile.description,
        filename: inputFile.file.name,
        mimetype: inputFile.file.mimetype,
        src: inputFile.file.base64,
        username,
      })

      // uploading a duplicate
      req.body = inputFile
      await router.postRoutes[route](req, res)

      validateTest({
        inputFile,
        expectedFilename: `${testBaseFileName}(1).${testFileExtension}`,
        responseBody: res.body,
      })
    })

    describe('Uploading duplicate files, non-duplicate syntax file names', function () {

      it('uploads duplicate file, original does not exists in db', async function () {
        // adding original file to db, but with the syntax of a duplicate filename
        fileRepository.insertFile({
          description: inputFile.description,
          filename: `${testBaseFileName}(1).${testFileExtension}`,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        })
  
        // uploading original file
        req.body = inputFile
        await router.postRoutes[route](req, res)

        validateTest({
          inputFile,
          expectedFilename: inputFile.file.name,
          responseBody: res.body,
        })
      })

      it('uploads 1st duplicate, original exists in db', async function () {
        // adding original file to db
        fileRepository.insertFile({
          description: inputFile.description,
          filename: inputFile.file.name,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        })
  
        // uploading a duplicate
        req.body = inputFile
        await router.postRoutes[route](req, res)

        validateTest({
          inputFile,
          expectedFilename: `${testBaseFileName}(1).${testFileExtension}`,
          responseBody: res.body,
        })
      })
  
      it('uploads 2nd duplicate file, original exists in db', async function () {
        // inserting previous uploads
        fileRepository.bulkInsertFiles([
          {
            description: inputFile.description,
            filename: inputFile.file.name,
            mimetype: inputFile.file.mimetype,
            src: inputFile.file.base64,
            username,
          },
          {
            description: inputFile.description,
            filename: `${testBaseFileName}(1).${testFileExtension}`,
            mimetype: inputFile.file.mimetype,
            src: inputFile.file.base64,
            username,
          },
        ])
  
        // uploading original file
        req.body = inputFile
        await router.postRoutes[route](req, res)

        validateTest({
          inputFile,
          expectedFilename: `${testBaseFileName}(2).${testFileExtension}`,
          responseBody: res.body,
        })
      })
    })

    describe('Uploading duplicate files, names in duplicate syntax', function () {
      beforeEach(function () {
        inputFile = buildUploadData({ baseFileName: 'test(1)', fileExt: 'png' })
      })

      it('uploads orignal file', async function () {
        req.body = inputFile
        await router.postRoutes[route](req, res)
  

        validateTest({
          inputFile,
          expectedFilename: inputFile.file.name,
          responseBody: res.body,
        })   
      })

      it('uploads 1st duplicate file (2nd uploaded)', async function () {
        // inserting original into DB
        fileRepository.insertFile({
          description: inputFile.description,
          filename: 'test(1).png',
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        })
        
        // uploading duplicate of test(1).png
        req.body = inputFile
        await router.postRoutes[route](req, res)

        validateTest({
          inputFile,
          expectedFilename: 'test(1)(1).png',
          responseBody: res.body,
        })   
      })

      it('uploads 2nd duplicate file (3rd uploaded)', async function () {
        // inseting files into DB
        fileRepository.bulkInsertFiles([
          {
            description: inputFile.description,
            filename: 'test(1).png',
            mimetype: inputFile.file.mimetype,
            src: inputFile.file.base64,
            username,
          },
          {
            description: inputFile.description,
            filename: 'test(1)(1).png',
            mimetype: inputFile.file.mimetype,
            src: inputFile.file.base64,
            username,
          },
        ])

        // uploading 3rd file (2nd duplicate) of test(1).png
        req.body = inputFile
        await router.postRoutes[route](req, res)

        validateTest({
          inputFile,
          expectedFilename: 'test(1)(2).png',
          responseBody: res.body,
        })     
      })
    })

  })

  describe('Upload duplicates fill gaps, original file named', function () {

    this.beforeAll(async function () {
      route = '/api/files'
      db.resetToSeed()
      inputFile = buildUploadData({})
      fileRepository.bulkInsertFiles([
        {
          description: inputFile.description,
          filename: inputFile.file.name,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        },
        {
          description: inputFile.description,
          filename: `${testBaseFileName}(1).${testFileExtension}`,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        },
        {
          description: inputFile.description,
          filename: `${testBaseFileName}(3).${testFileExtension}`,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        },
        {
          description: inputFile.description,
          filename: `${testBaseFileName}(5).${testFileExtension}`,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        },
      ])
    })

    const testCases = [
      `${testBaseFileName}(2).${testFileExtension}`,
      `${testBaseFileName}(4).${testFileExtension}`,
      `${testBaseFileName}(6).${testFileExtension}`,
    ]
  
    testCases.forEach((testCase) => {
      it(`uploaded file name should be "${testCase}"`, async function () {
        req.body = inputFile
        await router.postRoutes[route](req, res)

        validateTest({
          inputFile,
          expectedFilename: testCase,
          responseBody: res.body,
        })
      })
    })
  })

  describe('Upload duplicates fill gaps, original file name is already in duplicate syntax', function () {
    this.beforeAll(async function () {
      const baseTestFilename = `${testBaseFileName}(1)`
      route = '/api/files'
      inputFile = buildUploadData({ baseFileName: baseTestFilename })
      db.resetToSeed()
      fileRepository.bulkInsertFiles([
        {
          description: inputFile.description,
          filename: inputFile.file.name,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        },
        {
          description: inputFile.description,
          filename: `${baseTestFilename}(2).${testFileExtension}`,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        },
        {
          description: inputFile.description,
          filename: `${baseTestFilename}(3).${testFileExtension}`,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        },
        {
          description: inputFile.description,
          filename: `${baseTestFilename}(5).${testFileExtension}`,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        },
        {
          description: inputFile.description,
          filename: `${baseTestFilename}(8).${testFileExtension}`,
          mimetype: inputFile.file.mimetype,
          src: inputFile.file.base64,
          username,
        },
      ])
    })

    const testCases = [
      `${testBaseFileName}(1)(1).${testFileExtension}`,
      `${testBaseFileName}(1)(4).${testFileExtension}`,
      `${testBaseFileName}(1)(6).${testFileExtension}`,
      `${testBaseFileName}(1)(7).${testFileExtension}`,
      `${testBaseFileName}(1)(9).${testFileExtension}`,
    ]
  
    testCases.forEach((testCase) => {
      it(`uploaded file name should be "${testCase}"`, async function () {
        req.body = inputFile
        await router.postRoutes[route](req, res)

        validateTest({
          inputFile,
          expectedFilename: testCase,
          responseBody: res.body,
        })
      })
    })
  })
})
