/*
 * (c) Copyright Ascensio System Limited 2010-2017. All rights reserved
 *
 * http://www.teamlab.com 
 *
 * Version: 4.2.10 (build:10)
 */


var path = require('path');
var constants = require('./constants');
var logger = require('./logger');

function getImageFormatBySignature(buffer) {
  var length = buffer.length;
  var startText = buffer.toString('ascii', 0, 20);
  if ((3 <= length) && (0xFF == buffer[0]) && (0xD8 == buffer[1]) && (0xFF == buffer[2])) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_JPG;
  }
  if ((34 <= length) && (0x42 == buffer[0]) && (0x4D == buffer[1]) && (0x00 == buffer[6]) && (0x00 == buffer[7]) &&
    (0x01 == buffer[26]) && (0x00 == buffer[27]) && ((0x00 == buffer[28]) || (0x01 == buffer[28]) ||
    (0x04 == buffer[28]) || (0x08 == buffer[28]) || (0x10 == buffer[28]) || (0x18 == buffer[28]) ||
    (0x20 == buffer[28])) && (0x00 == buffer[29]) && ((0x00 == buffer[30]) || (0x01 == buffer[30]) ||
    (0x02 == buffer[30]) || (0x03 == buffer[30]) || (0x04 == buffer[30]) || (0x05 == buffer[30])) &&
    (0x00 == buffer[31]) && (0x00 == buffer[32]) && (0x00 == buffer[33])) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_BMP;
  }
  if (0 == startText.indexOf('GIF8')) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_GIF;
  }
  if (0 == startText.indexOf('GIF87a') || 0 == startText.indexOf('GIF89a')) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_GIF;
  }
  if ((16 <= length) && (0x89 == buffer[0]) && (0x50 == buffer[1]) && (0x4E == buffer[2]) && (0x47 == buffer[3]) &&
    (0x0D == buffer[4]) && (0x0A == buffer[5]) && (0x1A == buffer[6]) && (0x0A == buffer[7]) &&
    (0x00 == buffer[8]) && (0x00 == buffer[9]) && (0x00 == buffer[10]) && (0x0D == buffer[11]) &&
    (0x49 == buffer[12]) && (0x48 == buffer[13]) && (0x44 == buffer[14]) && (0x52 == buffer[15])) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_PNG;
  }
  if ((10 <= length) && (0x49 == buffer[0]) && (0x49 == buffer[1]) && (0x2A == buffer[2]) &&
    (0x00 == buffer[3]) && (0x10 == buffer[4]) && (0x00 == buffer[5]) && (0x00 == buffer[6]) &&
    (0x00 == buffer[7]) && (0x43 == buffer[8]) && (0x52 == buffer[9])) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_CR2;
  }
  if (4 <= length) {
    if (((0x49 == buffer[0]) && (0x49 == buffer[1]) && (0x2A == buffer[2]) && (0x00 == buffer[3])) ||
      ((0x4D == buffer[0]) && (0x4D == buffer[1]) && (0x00 == buffer[2]) && (0x2A == buffer[3])) ||
      ((0x49 == buffer[0]) && (0x49 == buffer[1]) && (0x2A == buffer[2]) && (0x00 == buffer[3]))) {
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_TIFF;
    }
  }
  if (6 <= length) {
    if (((0xD7 == buffer[0]) && (0xCD == buffer[1]) && (0xC6 == buffer[2]) && (0x9A == buffer[3]) &&
      (0x00 == buffer[4]) && (0x00 == buffer[5])) || ((0x01 == buffer[0]) && (0x00 == buffer[1]) &&
      (0x09 == buffer[2]) && (0x00 == buffer[3]) && (0x00 == buffer[4]) && (0x03 == buffer[5]))) {
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_WMF;
    }
  }
  if ((44 <= length) && (0x01 == buffer[0]) && (0x00 == buffer[1]) && (0x00 == buffer[2]) && (0x00 == buffer[3]) &&
    (0x20 == buffer[40]) && (0x45 == buffer[41]) && (0x4D == buffer[42]) && (0x46 == buffer[43])) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_EMF;
  }
  if ((4 <= length) && (0x0A == buffer[0]) && (0x00 == buffer[1] || 0x01 == buffer[1] ||
    0x02 == buffer[1] || 0x03 == buffer[1] || 0x04 == buffer[1] || 0x05 == buffer[1]) &&
    (0x01 == buffer[3] || 0x02 == buffer[3] || 0x04 == buffer[3] || 0x08 == buffer[3])) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_PCX;
  }
  if ((17 <= length) && ((0x01 == buffer[1] && 0x01 == buffer[2]) || (0x00 == buffer[1] && 0x02 == buffer[2]) ||
    (0x00 == buffer[1] && 0x03 == buffer[2]) || (0x01 == buffer[1] && 0x09 == buffer[2]) ||
    (0x00 == buffer[1] && 0x0A == buffer[2]) || (0x00 == buffer[1] && 0x0B == buffer[2])) &&
    (0x08 == buffer[16] || 0x10 == buffer[16] || 0x18 == buffer[16] || 0x20 == buffer[16])) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_TGA;
  }
  if ((4 <= length) && (0x59 == buffer[0]) && (0xA6 == buffer[1]) && (0x6A == buffer[2]) && (0x95 == buffer[3])) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_RAS;
  }
  if ((13 <= length) && (0x38 == buffer[0]) && (0x42 == buffer[1]) && (0x50 == buffer[2]) &&
    (0x53 == buffer[3]) && (0x00 == buffer[4]) && (0x01 == buffer[5]) && (0x00 == buffer[6]) &&
    (0x00 == buffer[7]) && (0x00 == buffer[8]) && (0x00 == buffer[9]) && (0x00 == buffer[10]) &&
    (0x00 == buffer[11]) && (0x00 == buffer[12])) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_PSD;
  }
  if (4 <= length && 0x00 == buffer[0] && 0x00 == buffer[1] && 0x01 == buffer[2] && 0x00 == buffer[3]) {
    return constants.AVS_OFFICESTUDIO_FILE_IMAGE_ICO;
  }
  if (0 == startText.indexOf('<svg')) {
    return constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_SVG;
  }

  return constants.AVS_OFFICESTUDIO_FILE_UNKNOWN;
}
exports.getFormatFromString = function(ext) {
  switch (ext.toLowerCase()) {
    case 'docx':
      return constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_DOCX;
    case 'doc':
      return constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_DOC;
    case 'odt':
      return constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_ODT;
    case 'rtf':
      return constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_RTF;
    case 'txt':
    case 'xml':
    case 'xslt':
      return constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_TXT;
    case 'htm':
    case 'html':
      return constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_HTML;
    case 'mht':
      return constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_MHT;
    case 'epub':
      return constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_EPUB;
    case 'fb2':
      return constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_FB2;
    case 'mobi':
      return constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_MOBI;

    case 'pptx':
      return constants.AVS_OFFICESTUDIO_FILE_PRESENTATION_PPTX;
    case 'ppt':
      return constants.AVS_OFFICESTUDIO_FILE_PRESENTATION_PPT;
    case 'odp':
      return constants.AVS_OFFICESTUDIO_FILE_PRESENTATION_ODP;
    case 'ppsx':
      return constants.AVS_OFFICESTUDIO_FILE_PRESENTATION_PPSX;

    case 'xlsx':
      return constants.AVS_OFFICESTUDIO_FILE_SPREADSHEET_XLSX;
    case 'xls':
      return constants.AVS_OFFICESTUDIO_FILE_SPREADSHEET_XLS;
    case 'ods':
      return constants.AVS_OFFICESTUDIO_FILE_SPREADSHEET_ODS;
    case 'csv':
      return constants.AVS_OFFICESTUDIO_FILE_SPREADSHEET_CSV;

    case 'jpeg':
    case 'jpe':
    case 'jpg':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_JPG;
    case 'tif':
    case 'tiff':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_TIFF;
    case 'tga':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_TGA;
    case 'gif':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_GIF;
    case 'png':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_PNG;
    case 'emf':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_EMF;
    case 'wmf':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_WMF;
    case 'bmp':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_BMP;
    case 'cr2':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_CR2;
    case 'pcx':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_PCX;
    case 'ras':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_RAS;
    case 'psd':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_PSD;
    case 'ico':
      return constants.AVS_OFFICESTUDIO_FILE_IMAGE_ICO;

    case 'pdf':
      return constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_PDF;
    case 'swf':
      return constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_SWF;
    case 'djvu':
      return constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_DJVU;
    case 'xps':
      return constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_XPS;
    case 'svg':
      return constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_SVG;
    case 'htmlr':
      return constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_HTMLR;
    case 'doct':
      return constants.AVS_OFFICESTUDIO_FILE_TEAMLAB_DOCY;
    case 'xlst':
      return constants.AVS_OFFICESTUDIO_FILE_TEAMLAB_XLSY;
    case 'pptt':
      return constants.AVS_OFFICESTUDIO_FILE_TEAMLAB_PPTY;
    default:
      return constants.AVS_OFFICESTUDIO_FILE_UNKNOWN;
  }
};
exports.getStringFromFormat = function(format) {
  switch (format) {
    case constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_DOCX:
      return 'docx';
    case constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_DOC:
      return 'doc';
    case constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_ODT:
      return 'odt';
    case constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_RTF:
      return 'rtf';
    case constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_TXT:
      return 'txt';
    case constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_HTML:
      return 'html';
    case constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_MHT:
      return 'mht';
    case constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_EPUB:
      return 'epub';
    case constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_FB2:
      return 'fb2';
    case constants.AVS_OFFICESTUDIO_FILE_DOCUMENT_MOBI:
      return 'mobi';

    case constants.AVS_OFFICESTUDIO_FILE_PRESENTATION_PPTX:
      return 'pptx';
    case constants.AVS_OFFICESTUDIO_FILE_PRESENTATION_PPT:
      return 'ppt';
    case constants.AVS_OFFICESTUDIO_FILE_PRESENTATION_ODP:
      return 'odp';
    case constants.AVS_OFFICESTUDIO_FILE_PRESENTATION_PPSX:
      return 'ppsx';

    case constants.AVS_OFFICESTUDIO_FILE_SPREADSHEET_XLSX:
      return 'xlsx';
    case constants.AVS_OFFICESTUDIO_FILE_SPREADSHEET_XLS:
      return 'xls';
    case constants.AVS_OFFICESTUDIO_FILE_SPREADSHEET_ODS:
      return 'ods';
    case constants.AVS_OFFICESTUDIO_FILE_SPREADSHEET_CSV:
      return 'csv';

    case constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_PDF:
      return 'pdf';
    case constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_SWF:
      return 'swf';
    case constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_DJVU:
      return 'djvu';
    case constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_XPS:
      return 'xps';
    case constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_SVG:
      return 'svg';
    case constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_HTMLR:
      return 'htmlr';

    case constants.AVS_OFFICESTUDIO_FILE_OTHER_HTMLZIP:
      return 'zip';
    case constants.AVS_OFFICESTUDIO_FILE_OTHER_JSON:
      return 'json';

    case constants.AVS_OFFICESTUDIO_FILE_IMAGE:
      return 'jpg';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_JPG:
      return 'jpg';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_TIFF:
      return 'tiff';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_TGA:
      return 'tga';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_GIF:
      return 'gif';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_PNG:
      return 'png';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_EMF:
      return 'emf';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_WMF:
      return 'wmf';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_BMP:
      return 'bmp';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_CR2:
      return 'cr2';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_PCX:
      return 'pcx';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_RAS:
      return 'ras';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_PSD:
      return 'psd';
    case constants.AVS_OFFICESTUDIO_FILE_IMAGE_ICO:
      return 'ico';

    case constants.AVS_OFFICESTUDIO_FILE_CANVAS_WORD:
    case constants.AVS_OFFICESTUDIO_FILE_CANVAS_SPREADSHEET:
    case constants.AVS_OFFICESTUDIO_FILE_CANVAS_PRESENTATION:
      return 'bin';
    case constants.AVS_OFFICESTUDIO_FILE_OTHER_OLD_DOCUMENT:
    case constants.AVS_OFFICESTUDIO_FILE_TEAMLAB_DOCY:
      return 'doct';
    case constants.AVS_OFFICESTUDIO_FILE_TEAMLAB_XLSY:
      return 'xlst';
    case constants.AVS_OFFICESTUDIO_FILE_OTHER_OLD_PRESENTATION:
    case constants.AVS_OFFICESTUDIO_FILE_OTHER_OLD_DRAWING:
    case constants.AVS_OFFICESTUDIO_FILE_TEAMLAB_PPTY:
      return 'pptt';
    default:
      return '';
  }
};
exports.getImageFormat = function(buffer, optExt) {
  var format = constants.AVS_OFFICESTUDIO_FILE_UNKNOWN;
  try {
    format = getImageFormatBySignature(buffer);
    if (constants.AVS_OFFICESTUDIO_FILE_UNKNOWN == format && optExt) {
      if ('.svg' == optExt) {
        format = constants.AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_SVG;
      } else {
        if (optExt.length > 0 && '.' == optExt[0]) {
          optExt = optExt.substring(1);
        }
        format = exports.getFormatFromString(optExt);
      }
    }
  }
  catch (e) {
    logger.error(optExt);
    logger.error('error getImageFormat:\r\n%s', e.stack);
  }
  return format;
};
