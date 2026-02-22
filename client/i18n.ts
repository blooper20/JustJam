import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

// Can be imported from a shared config
const locales = ['en', 'ko'];

export default getRequestConfig(async (params) => {
    const locale = params.locale || 'ko';
    // Validate that the incoming `locale` parameter is valid
    if (!locales.includes(locale)) notFound();

    return {
        locale,
        messages: (await import(`./messages/${locale}.json`)).default
    };
});
