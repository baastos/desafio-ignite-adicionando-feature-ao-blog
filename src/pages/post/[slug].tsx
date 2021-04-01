import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';

import { FiCalendar, FiUser, FiClock } from 'react-icons/fi';
import Prismic from '@prismicio/client';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import { RichText } from 'prismic-dom';
import { useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getPrismicClient } from '../../services/prismic';

import commonStyles from '../../styles/common.module.scss';
import styles from './post.module.scss';
import Header from '../../components/Header';
import { Comments } from '../../components/Comments';

interface Post {
  first_publication_date: string | null;
  last_publication_date: string | null;
  uid: string;
  data: {
    title: string;
    banner: {
      url: string;
    };
    author: string;
    content: {
      heading: string;
      body: {
        text: string;
      }[];
    }[];
  };
}
interface PaginationProps {
  title: string;
  href: string;
}
interface Pagination {
  nextPage: PaginationProps;
  prevPage: PaginationProps;
}
interface PostProps {
  post: Post;
  preview: boolean;
  pagination: Pagination;
}

export default function Post({
  post,
  preview,
  pagination,
}: PostProps): JSX.Element {
  const router = useRouter();
  const { prevPage, nextPage } = pagination;
  const HUMAN_READ_TIME_PER_MINUTE = 200;

  const readTime = useMemo((): string => {
    const totalWords = post.data.content.reduce((acc, content) => {
      const headingTotal = content.heading.split(' ').length;

      const contentTotal = RichText.asText(content.body).split(' ').length;

      const total = headingTotal + contentTotal;

      return acc + total;
    }, 0);

    return `${Math.ceil(totalWords / HUMAN_READ_TIME_PER_MINUTE)} min`;

  }, [post.data.content]);



  return (
    <>
      <Head>
        <title>Post | Spacetravelling</title>
      </Head>

      <Header />

      <div className={styles.banner}>
        <img src={post.data.banner.url} alt="banner" />
      </div>

      <main className={commonStyles.container}>
        <article className={styles.post}>

          <h1>{router.isFallback ? 'Carregando...' : post.data.title}</h1>

          <div className={styles.iconsContainer}>
            <span>
              <FiCalendar />
              <time>
                {format(new Date(post?.first_publication_date), 'dd MMM yyyy', {
                  locale: ptBR,
                })}
              </time>
            </span>

            <span>
              <FiUser />
              {post.data.author}
            </span>

            <span>
              <FiClock />
              {`${readTime}`}
            </span>

          </div>
          {post.last_publication_date && (
            <time className={styles.editedWhen}>
              * editado em
              {format(
                new Date(post.last_publication_date),
                " dd MMM yyyy',' 'às' HH':'mm",
                {
                  locale: ptBR,
                }
              )}
            </time>
          )}
          {post.data.content.map(content => (
            <div key={content.heading} className={styles.content}>
              <h2>{content.heading}</h2>
              <div
                dangerouslySetInnerHTML={{
                  __html: RichText.asHtml(content.body),
                }}
              />
            </div>
          ))}
        </article>

        <div className={styles.parentPosts}>

          {prevPage ? (
            <div>
              <span>{prevPage.title}</span>
              <Link href={prevPage.href}>
                <a>Post anterior</a>
              </Link>
            </div>
          ) : (
            <div />
          )}
          {nextPage ? (
            <div>
              <span>{nextPage.title}</span>
              <a href={nextPage.href}>Próximo post</a>
            </div>
          ) : (
            <div />
          )}
        </div>

        <Comments />

        {preview && (
          <aside className={styles.previewButton}>
            <a href="/api/exit-preview">Sair do modo preview</a>
          </aside>
        )}
      </main>
    </>
  );
}
export const getStaticPaths: GetStaticPaths = async () => {
  const prismic = getPrismicClient();
  const posts = await prismic.query(
    [Prismic.predicates.at('document.type', 'post')],
    {
      pageSize: 20,
    }
  );

  const paths = posts.results.map(post => ({
    params: {
      slug: post.uid,
    },
  }));

  return {
    paths,
    fallback: true,
  };
};

export const getStaticProps: GetStaticProps = async context => {
  const prismic = getPrismicClient();

  const { params, preview = false, previewData } = context;

  const { slug } = params;

  const response = await prismic.getByUID('post', String(slug), {
    ref: previewData?.ref ?? null,
  });
  const post = {
    first_publication_date: response.first_publication_date,
    last_publication_date: response.last_publication_date,
    uid: response.uid,
    data: {
      subtitle: response.data.subtitle,
      title: response.data.title,
      banner: {
        url: response.data.banner.url,
      },
      author: response.data.author,
      content: response.data.content,
    },
  };

  const {
    results: [nextPage],
  } = await prismic.query(
    [
      Prismic.Predicates.at('document.type', 'post'),
      Prismic.Predicates.dateAfter(
        'document.first_publication_date',
        response.first_publication_date ?? new Date()
      ),
    ],
    { pageSize: 1 }
  );
  const {
    results: [prevPage],
  } = await prismic.query(
    [
      Prismic.Predicates.at('document.type', 'post'),
      Prismic.Predicates.dateBefore(
        'document.first_publication_date',
        response.first_publication_date ?? new Date()
      ),
    ],
    { pageSize: 1 }
  );

  const pagination = {
    nextPage: nextPage
      ? {
        title: nextPage.data.title,
        href: `/post/${nextPage.uid}`,
      }
      : null,

    prevPage: prevPage
      ? {
        title: prevPage.data.title,
        href: `/post/${prevPage.uid}`,
      }
      : null,
  };

  return {
    props: {
      post,
      preview,
      pagination,
    },
  };
};
