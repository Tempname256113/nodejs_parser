const puppeteer = require('puppeteer');
const fs = require('node:fs');
const fsPromises = require('node:fs').promises;
const path = require('node:path');

(async () => {
  const args = process.argv.slice(2);
  const poductUrl = args[0];
  const regionName = args[1];

  const requiredArgsIsProvided = poductUrl && regionName;

  if (!requiredArgsIsProvided) {
    throw new Error('You need to provide product url and region');
  }

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.setViewport({
    width: 1600,
    height: 900,
  });

  await page.goto(poductUrl, { waitUntil: 'networkidle2' });

  const clickToElement = async (providedSelector) => {
    await page.waitForSelector(providedSelector, { visible: true });
    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.click();
      }
    }, providedSelector);
  };

  // закрыть начальный попап при переходе на страницу
  await clickToElement('#\\:r0\\: > button');

  // открыть список регионов
  await clickToElement(
    '#__next > div.FeatureAppLayoutBase_layout__0HSBo.FeatureAppLayoutBase_hideBannerMobile__97CUm.FeatureAppLayoutBase_hideBannerTablet__dCMoJ.FeatureAppLayoutBase_hideBannerDesktop__gPdf1 > div:nth-child(3) > div.UiHeaderHorizontalBase_secondRow__7b4Lk > div > div.UiHeaderHorizontalBase_region__2ODCG > div',
  );

  // выбрать регион
  await page.waitForSelector('.UiRegionListBase_item___ly_A', {
    visible: true,
  });
  await page.evaluate((region) => {
    const items = document.querySelectorAll('.UiRegionListBase_item___ly_A');
    for (let item of items) {
      if (item.textContent.trim() === region) {
        item.click();
        break;
      }
    }
  }, regionName);

  // Функция для очистки имени от недопустимых символов
  const sanitizeFilename = (name) => {
    // Сначала удаляем все запрещённые символы, кроме точки
    let sanitizedName = name.replace(/[<>:"/\\|?*]+/g, '').trim();

    // Удаляем точку в конце, если она там есть
    sanitizedName = sanitizedName.replace(/\.+$/, '');

    return sanitizedName;
  };

  const currentProductName = await page.evaluate(() => {
    return document.querySelector(
      '#__next > div.FeatureAppLayoutBase_layout__0HSBo.FeatureAppLayoutBase_hideBannerMobile__97CUm.FeatureAppLayoutBase_hideBannerTablet__dCMoJ.FeatureAppLayoutBase_hideBannerDesktop__gPdf1 > main > div:nth-child(3) > div > div.ProductPage_title__3hOtE > div:nth-child(2) > h1',
    ).innerText;
  });

  const filesPath = path.join(
    sanitizeFilename(regionName),
    sanitizeFilename(currentProductName),
  );

  await fsPromises.mkdir(filesPath, { recursive: true });

  await page.screenshot({
    path: path.join(filesPath, 'screenshot.jpg'),
    fullPage: true,
  });

  const productData = await page.evaluate(() => {
    const priceBlock = document.querySelector(
      '#__next > div.FeatureAppLayoutBase_layout__0HSBo.FeatureAppLayoutBase_hideBannerMobile__97CUm.FeatureAppLayoutBase_hideBannerTablet__dCMoJ.FeatureAppLayoutBase_hideBannerDesktop__gPdf1 > main > div:nth-child(3) > div > div.ProductPage_informationBlock__vDYCH > div.ProductPage_desktopBuy__cyRrC > div > div > div > div.PriceInfo_root__GX9Xp > span',
    );
    const oldPriceBlock = document.querySelector(
      '#__next > div.FeatureAppLayoutBase_layout__0HSBo.FeatureAppLayoutBase_hideBannerMobile__97CUm.FeatureAppLayoutBase_hideBannerTablet__dCMoJ.FeatureAppLayoutBase_hideBannerDesktop__gPdf1 > main > div:nth-child(3) > div > div.ProductPage_informationBlock__vDYCH > div.ProductPage_desktopBuy__cyRrC > div > div > div > div.PriceInfo_root__GX9Xp > div > span.Price_price__QzA8L.Price_size_XS__ESEhJ.Price_role_old__r1uT1',
    );
    const ratingBlock = document.querySelector(
      '#__next > div.FeatureAppLayoutBase_layout__0HSBo.FeatureAppLayoutBase_hideBannerMobile__97CUm.FeatureAppLayoutBase_hideBannerTablet__dCMoJ.FeatureAppLayoutBase_hideBannerDesktop__gPdf1 > main > div:nth-child(3) > div > div.ProductPage_aboutAndReviews__47Wwu > div.DetailsAndReviews_root__ghQFz > section.Summary_section__n5aJB > div:nth-child(6) > div > div.Summary_title__lRoWU',
    );
    const reviewsBlock = document.querySelector(
      '#__next > div.FeatureAppLayoutBase_layout__0HSBo.FeatureAppLayoutBase_hideBannerMobile__97CUm.FeatureAppLayoutBase_hideBannerTablet__dCMoJ.FeatureAppLayoutBase_hideBannerDesktop__gPdf1 > main > div:nth-child(3) > div > div.ProductPage_aboutAndReviews__47Wwu > div.DetailsAndReviews_root__ghQFz > section.Summary_section__n5aJB > div.Summary_reviewsContainer__qTWIu.Summary_reviewsCountContainer___aY6I > div > div',
    );

    return {
      price: parseFloat(
        priceBlock.innerText.replace(/[^\d,]/g, '').replace(',', '.'),
      ), // Удаляем всё, кроме чисел и запятой, потом меняем запятую на точку
      priceOld: parseFloat(
        oldPriceBlock.innerText?.replace(/[^\d,]/g, '').replace(',', '.') ||
          'Нет старой цены',
      ), // Аналогично для старой цены
      rating: parseFloat(ratingBlock.innerText),
      reviewCount: parseInt(reviewsBlock.innerText),
    };
  });

  const productInfo = `
price=${productData.price}
priceOld=${productData.priceOld}
rating=${productData.rating}
reviewCount=${productData.reviewCount}
  `;
  fs.writeFileSync(path.join(filesPath, 'product.txt'), productInfo);

  await browser.close();
})();
