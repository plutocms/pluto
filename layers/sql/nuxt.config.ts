export default defineNuxtConfig({
  $meta: {
    name: 'sql',
  },

  nitro: {
    experimental: {
      database: true,
    },

    database: {
      default: {
        connector: 'mysql2',
        options: {
          host: process.env.PLUTO_MYSQL_HOST || 'localhost',
          port: process.env.PLUTO_MYSQL_PORT
            ? Number(process.env.PLUTO_MYSQL_PORT)
            : 3306,
          user: process.env.PLUTO_MYSQL_USER || 'root',
          password: process.env.PLUTO_MYSQL_PASSWORD || '',
          database: process.env.PLUTO_MYSQL_DATABASE || '',
        },
      },
    },
  },
})
